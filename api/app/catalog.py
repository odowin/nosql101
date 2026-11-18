"""Lot 1 — Catalogue produits (MongoDB) avec cache-aside Redis sur la fiche produit."""
import json
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from bson import Decimal128, ObjectId
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from pymongo.errors import DuplicateKeyError

from app.db import mongo_db, redis_client, to_json

router = APIRouter(tags=["Lot 1 — Catalogue (MongoDB)"])

CACHE_TTL = 300
LIST_PROJECTION = {"specs": 0, "top_reviews": 0}
CENT = Decimal("0.01")


def _dt(v) -> datetime:
    return v if isinstance(v, datetime) else datetime.fromisoformat(v)


def effective_price(product: dict, now: datetime | None = None) -> tuple[Decimal, int | None, bool]:
    """(prix effectif, remise en %, en promo) : promo en cours ssi starts_at <= now < ends_at.

    Accepte le document MongoDB (Decimal128, datetime) ou sa forme JSON en cache (float, ISO).
    """
    price = Decimal(str(product["price"]))
    promo = product.get("promo")
    now = now or datetime.now(timezone.utc)
    if not promo or not _dt(promo["starts_at"]) <= now < _dt(promo["ends_at"]):
        return price, None, False
    if promo.get("price") is not None:
        eff = Decimal(str(promo["price"]))
    else:
        eff = (price * (100 - promo["percent"]) / 100).quantize(CENT, ROUND_HALF_UP)
    discount = promo.get("percent") or int(((1 - eff / price) * 100).quantize(Decimal(1), ROUND_HALF_UP))
    return eff, discount, True


def price_fields(product: dict) -> dict:
    """Champs de prix ajoutés à toute réponse produit (calculés à la lecture, même depuis le cache)."""
    eff, discount, on_sale = effective_price(product)
    return {"effective_price": float(eff), "on_sale": on_sale, "discount_percent": discount,
            "promo": to_json(product.get("promo"))}


def with_price(product: dict) -> dict:
    return {**product, **price_fields(product)}


def compatible_for(sku: str, compat: dict, limit: int = 5) -> list[dict]:
    """Subset `compatible` : A utilise un standard que B supporte, ou l'inverse."""
    uses, supports = compat.get("uses", []), compat.get("supports", [])
    if not uses and not supports:
        return []
    query = {"_id": {"$ne": sku},
             "$or": [{"compat.supports": {"$in": uses}}, {"compat.uses": {"$in": supports}}]}
    return [{"sku": p["_id"], "name": p["name"]}
            for p in mongo_db().products.find(query, {"name": 1}).sort("_id", 1).limit(limit)]


def _spec_values(v: str) -> list:
    # La valeur d'une spec peut être texte, nombre ou booléen : on essaie les coercitions.
    values: list = [v]
    if v.lower() in ("true", "false"):
        values.append(v.lower() == "true")
    for cast in (int, float):
        try:
            values.append(cast(v))
        except ValueError:
            pass
    return values


# Le tri a lieu avant skip/limit (pagination stable), `_id` départage les ex æquo.
SORTS = {
    "price_asc": {"_eff": 1}, "price_desc": {"_eff": -1}, "name": {"name": 1},
    "rating": {"rating.avg": -1, "rating.count": -1}, "discount": {"_discount": -1},
}


def _sort_fields(now: datetime) -> dict:
    """Prix effectif et remise calculés côté MongoDB, même règle que `effective_price` (au demi-centime près)."""
    active = {"$and": [{"$lte": ["$promo.starts_at", now]}, {"$gt": ["$promo.ends_at", now]}]}
    by_percent = {"$round": [{"$divide": [{"$multiply": ["$price", {"$subtract": [100, "$promo.percent"]}]}, 100]}, 2]}
    eff = {"$cond": [active, {"$ifNull": ["$promo.price", by_percent]}, "$price"]}
    discount = {"$ifNull": ["$promo.percent", {"$multiply": [{"$subtract": [1, {"$divide": [eff, "$price"]}]}, 100]}]}
    return {"_eff": eff, "_discount": {"$cond": [active, discount, 0]}}


@router.get("/categories")
def list_categories():
    """Arbre des catégories (pattern Array of Ancestors, reconstruit en arbre)."""
    nodes = {c["_id"]: {**c, "children": []} for c in mongo_db().categories.find()}
    roots = []
    for node in nodes.values():
        parent = nodes.get(node.get("parent"))
        (parent["children"] if parent else roots).append(node)
    return roots


@router.get("/products")
def list_products(
    category: str | None = None,
    brand: list[str] = Query([], description="Marque, répétable (l'une ou l'autre)"),
    q: str | None = Query(None, description="Recherche plein texte sur le nom"),
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    spec: list[str] = Query([], description="Filtre `k:v` répétable, ex. `socket:AM5`"),
    on_sale: bool = Query(False, description="Seulement les promos en cours"),
    in_stock: bool = Query(False, description="Seulement les produits expédiables (en stock ou stock faible)"),
    sort: Literal["price_asc", "price_desc", "name", "rating", "discount"] | None = Query(
        None, description="Tri ; par défaut par SKU. Les tris prix et remise portent sur le prix effectif"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    """Liste filtrée et triée (projection légère : sans specs ni avis). `min_price`/`max_price` portent sur le prix de référence."""
    query: dict[str, Any] = {}
    if on_sale:
        now = datetime.now(timezone.utc)
        query["promo.starts_at"] = {"$lte": now}
        query["promo.ends_at"] = {"$gt": now}
    if category:
        query["category._id"] = category
    if brand:
        query["brand._id"] = {"$in": brand}
    if in_stock:
        query["stock.status"] = {"$in": ["in_stock", "low_stock"]}
    if q:
        query["$text"] = {"$search": q}
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = Decimal128(str(min_price))
        if max_price is not None:
            query["price"]["$lte"] = Decimal128(str(max_price))
    if spec:
        matches = []
        for s in spec:
            k, sep, v = s.partition(":")
            if not sep:
                raise HTTPException(400, f"spec invalide '{s}', format attendu k:v")
            matches.append({"$elemMatch": {"k": k, "v": {"$in": _spec_values(v)}}})
        query["specs"] = {"$all": matches}
    products = mongo_db().products
    pipeline = [{"$match": query}]
    if sort in ("price_asc", "price_desc", "discount"):
        pipeline.append({"$addFields": _sort_fields(datetime.now(timezone.utc))})
    pipeline += [{"$sort": {**SORTS.get(sort, {}), "_id": 1}}, {"$skip": skip}, {"$limit": limit},
                 {"$project": {**LIST_PROJECTION, "_eff": 0, "_discount": 0}}]
    items = products.aggregate(pipeline)
    return {"total": products.count_documents(query), "items": [with_price(p) for p in to_json(list(items))]}


@router.get("/products/{sku}")
def get_product(sku: str):
    """Fiche complète. Cache-aside Redis `product:{sku}` (TTL 300 s), en-tête `X-Cache`.

    Le cache garde la promo brute ; le prix effectif est recalculé à chaque lecture.
    """
    key = f"product:{sku}"
    cached = redis_client().get(key)
    if cached:
        doc, status = json.loads(cached), "HIT"
    else:
        found = mongo_db().products.find_one({"_id": sku})
        if not found:
            raise HTTPException(404, "produit inconnu")
        doc, status = to_json(found), "MISS"
        redis_client().set(key, json.dumps(doc, ensure_ascii=False), ex=CACHE_TTL)
    return JSONResponse(with_price(doc), headers={"X-Cache": status})


class Spec(BaseModel):
    model_config = ConfigDict(extra="allow")
    k: str
    v: Any
    label: str | None = None
    u: str | None = None


class Promo(BaseModel):
    """Promo embarquée : exactement un de `percent` / `price`, en cours sur [starts_at, ends_at)."""
    label: str = Field(examples=["Black Friday"])
    percent: int | None = Field(None, ge=1, le=90)
    price: Decimal | None = Field(None, gt=0)
    starts_at: AwareDatetime
    ends_at: AwareDatetime

    @model_validator(mode="after")
    def _check(self):
        if (self.percent is None) == (self.price is None):
            raise ValueError("promo : exactement un de percent ou price")
        if self.ends_at <= self.starts_at:
            raise ValueError("promo : ends_at doit suivre starts_at")
        return self


class ProductIn(BaseModel):
    """Champs libres acceptés : tout attribut supplémentaire est stocké tel quel (schéma ouvert)."""
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    id: str = Field(alias="_id", examples=["CPU-AMD-R7-9700X"])
    name: str
    category: str = Field(examples=["cpu"])
    brand: str = Field(examples=["amd"])
    price: Decimal = Field(gt=0)
    slug: str | None = None
    range: str | None = None
    stock: dict | None = None
    specs: list[Spec] = []
    compat: dict = {"uses": [], "supports": []}
    promo: Promo | None = None

    @model_validator(mode="after")
    def _promo_below_price(self):
        if self.promo and self.promo.price is not None and self.promo.price >= self.price:
            raise ValueError("promo : le prix promo doit être inférieur au prix")
        return self


@router.post("/products", status_code=201)
def create_product(body: ProductIn):
    """Création d'un produit avec specs et attributs libres : aucune migration de schéma."""
    db = mongo_db()
    cat = db.categories.find_one({"_id": body.category})
    brand = db.brands.find_one({"_id": body.brand})
    if not cat or not brand:
        raise HTTPException(400, "catégorie ou marque inconnue")
    now = datetime.now(timezone.utc)
    doc = body.model_dump(by_alias=True, exclude_none=True)
    doc.update(
        slug=body.slug or body.id.lower(),
        category={"_id": cat["_id"], "name": cat["name"], "path": "/".join(cat["ancestors"] + [cat["_id"]])},
        brand={"_id": brand["_id"], "name": brand["name"]},
        price=Decimal128(str(body.price.quantize(Decimal("0.01")))),
        specs=[s.model_dump(exclude_none=True) for s in body.specs],
        compatible=compatible_for(body.id, body.compat),
        rating={"avg": 0, "count": 0, "sum": 0},
        top_reviews=[],
        schema_version=1,
        created_at=now,
        updated_at=now,
    )
    if body.promo:
        doc["promo"] = body.promo.model_dump(exclude_none=True)
        if body.promo.price is not None:
            doc["promo"]["price"] = Decimal128(str(body.promo.price.quantize(CENT)))
    try:
        db.products.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "produit (ou slug) déjà existant")
    return with_price(to_json(doc))


@router.get("/products/{sku}/reviews")
def list_reviews(sku: str, limit: int = Query(10, ge=1, le=100), skip: int = Query(0, ge=0)):
    """Avis paginés, du plus récent au plus ancien (collection `reviews`)."""
    db = mongo_db()
    if not db.products.find_one({"_id": sku}, {"_id": 1}):
        raise HTTPException(404, "produit inconnu")
    query = {"product_id": sku}
    items = db.reviews.find(query).sort("created_at", -1).skip(skip).limit(limit)
    return {"total": db.reviews.count_documents(query), "items": to_json(list(items))}


class ReviewIn(BaseModel):
    customer_id: str = Field(examples=["C0001"])
    author: str
    rating: int = Field(ge=1, le=5)
    title: str
    comment: str


@router.post("/products/{sku}/reviews", status_code=201)
def create_review(sku: str, body: ReviewIn):
    """Ajout d'un avis : maj `rating` (computed) et `top_reviews` (subset des 3 plus récents), puis invalidation du cache."""
    db = mongo_db()
    if not db.products.find_one({"_id": sku}, {"_id": 1}):
        raise HTTPException(404, "produit inconnu")
    now = datetime.now(timezone.utc)
    review = {"_id": ObjectId(), "product_id": sku, **body.model_dump(),
              "verified_purchase": False, "created_at": now}
    db.reviews.insert_one(review)
    top = {k: review[k] for k in ("_id", "author", "rating", "title", "comment", "created_at")}
    db.products.update_one({"_id": sku}, {
        "$push": {"top_reviews": {"$each": [top], "$sort": {"created_at": -1}, "$slice": 3}},
        "$inc": {"rating.count": 1, "rating.sum": body.rating},
        "$set": {"updated_at": now},
    })
    db.products.update_one({"_id": sku}, [
        {"$set": {"rating.avg": {"$round": [{"$divide": ["$rating.sum", "$rating.count"]}, 2]}}},
    ])
    redis_client().delete(f"product:{sku}")
    return to_json(review)
