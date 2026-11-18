"""Lot 1 — Catalogue produits (MongoDB) avec cache-aside Redis sur la fiche produit."""
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from bson import Decimal128, ObjectId
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError

from app.db import mongo_db, redis_client, to_json

router = APIRouter(tags=["Lot 1 — Catalogue (MongoDB)"])

CACHE_TTL = 300
LIST_PROJECTION = {"specs": 0, "top_reviews": 0}


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
    brand: str | None = None,
    q: str | None = Query(None, description="Recherche plein texte sur le nom"),
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    spec: list[str] = Query([], description="Filtre `k:v` répétable, ex. `socket:AM5`"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    """Liste filtrée (projection légère : sans specs ni avis)."""
    query: dict[str, Any] = {}
    if category:
        query["category._id"] = category
    if brand:
        query["brand._id"] = brand
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
    items = products.find(query, LIST_PROJECTION).sort("_id", 1).skip(skip).limit(limit)
    return {"total": products.count_documents(query), "items": to_json(list(items))}


@router.get("/products/{sku}")
def get_product(sku: str):
    """Fiche complète. Cache-aside Redis `product:{sku}` (TTL 300 s), en-tête `X-Cache`."""
    key = f"product:{sku}"
    cached = redis_client().get(key)
    if cached:
        return Response(cached, media_type="application/json", headers={"X-Cache": "HIT"})
    doc = mongo_db().products.find_one({"_id": sku})
    if not doc:
        raise HTTPException(404, "produit inconnu")
    body = json.dumps(to_json(doc), ensure_ascii=False)
    redis_client().set(key, body, ex=CACHE_TTL)
    return Response(body, media_type="application/json", headers={"X-Cache": "MISS"})


class Spec(BaseModel):
    model_config = ConfigDict(extra="allow")
    k: str
    v: Any
    label: str | None = None
    u: str | None = None


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
    try:
        db.products.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "produit (ou slug) déjà existant")
    return to_json(doc)


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
