"""Lot 2 — Sessions et paniers (Redis, TTL glissants) ; prix effectifs (promo comprise) lus dans MongoDB."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field

from app import analytics, reco
from app.catalog import effective_price, price_fields
from app.db import mongo_db, redis_client, to_json

router = APIRouter(tags=["Lot 2 — Panier & sessions (Redis)"])

SESSION_TTL = 1800
CART_TTL_ANON = 7 * 86400
CART_TTL_CUSTOMER = 30 * 86400


class LoginIn(BaseModel):
    customer_id: str


class ItemIn(BaseModel):
    sku: str
    quantity: int = Field(ge=1)


class QuantityIn(BaseModel):
    quantity: int = Field(ge=0)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cart_ttl(cart_id: str) -> int:
    return CART_TTL_ANON if cart_id.startswith("anon:") else CART_TTL_CUSTOMER


def get_session(sid: str | None) -> dict:
    """Session Redis (champs du hash + session_id) ou 401 si absente/expirée. Réutilisable (checkout)."""
    if not sid:
        raise HTTPException(401, "En-tête X-Session-Id requis")
    s = redis_client().hgetall(f"session:{sid}")
    if not s:
        raise HTTPException(401, "Session absente ou expirée")
    return {"session_id": sid, **s}


def _cart_view(session: dict) -> dict:
    """Panier enrichi du prix effectif courant (MongoDB) ; rafraîchit les TTL (glissant)."""
    cart_id, key = session["cart_id"], f"cart:{session['cart_id']}"
    pipe = redis_client().pipeline()
    pipe.hgetall(key)
    pipe.expire(key, _cart_ttl(cart_id))
    pipe.expire(f"session:{session['session_id']}", SESSION_TTL)
    pipe.ttl(key)
    lines, _, _, ttl = pipe.execute()
    products = {p["_id"]: p for p in mongo_db().products.find({"_id": {"$in": list(lines)}}, {"name": 1, "price": 1, "promo": 1})}
    items, total = [], Decimal(0)
    for sku, qty in sorted(lines.items()):
        p = products.get(sku)
        if p is None:  # produit retiré du catalogue : ligne ignorée
            continue
        qty = int(qty)
        unit = effective_price(p)[0]
        total += unit * qty
        items.append({"sku": sku, "name": p["name"], "price": float(p["price"].to_decimal()), **price_fields(p),
                      "unit_price": float(unit), "quantity": qty, "line_total": float(unit * qty)})
    return {"cart_id": cart_id, "items": items, "total": float(total), "ttl": ttl}


@router.post("/sessions", status_code=201)
def create_session():
    """Crée une session et son panier anonyme."""
    sid, cart_id, now = uuid.uuid4().hex, f"anon:{uuid.uuid4().hex}", _now()
    pipe = redis_client().pipeline()
    pipe.hset(f"session:{sid}", mapping={"customer_id": "", "cart_id": cart_id, "created_at": now, "last_seen": now})
    pipe.expire(f"session:{sid}", SESSION_TTL)
    pipe.execute()
    return {"session_id": sid, "cart_id": cart_id, "ttl": SESSION_TTL}


@router.get("/sessions/{sid}")
def read_session(sid: str):
    """Lit la session et prolonge son TTL (glissant)."""
    r = redis_client()
    key = f"session:{sid}"
    if not r.exists(key):
        raise HTTPException(404, "Session introuvable")
    pipe = r.pipeline()
    pipe.hset(key, "last_seen", _now())
    pipe.expire(key, SESSION_TTL)
    pipe.hgetall(key)
    pipe.ttl(key)
    *_, fields, ttl = pipe.execute()
    return {"session_id": sid, **fields, "ttl": ttl}


@router.post("/sessions/{sid}/login")
def login(sid: str, body: LoginIn):
    """Rattache le client et fusionne le panier anonyme dans son panier (HINCRBY, puis DEL de l'anonyme)."""
    r = redis_client()
    key = f"session:{sid}"
    session = r.hgetall(key)
    if not session:
        raise HTTPException(404, "Session introuvable")
    anon_id, cart_id = session["cart_id"], f"customer:{body.customer_id}"
    cart_key = f"cart:{cart_id}"
    pipe = r.pipeline()
    if anon_id.startswith("anon:"):  # session déjà connectée : rien à fusionner
        for sku, qty in r.hgetall(f"cart:{anon_id}").items():
            pipe.hincrby(cart_key, sku, int(qty))
        pipe.delete(f"cart:{anon_id}")
    pipe.expire(cart_key, CART_TTL_CUSTOMER)
    pipe.hset(key, mapping={"customer_id": body.customer_id, "cart_id": cart_id, "last_seen": _now()})
    pipe.expire(key, SESSION_TTL)
    pipe.execute()
    session = {**session, "session_id": sid, "customer_id": body.customer_id, "cart_id": cart_id}
    return {**session, "ttl": SESSION_TTL, "cart": _cart_view(session)}


@router.delete("/sessions/{sid}", status_code=204)
def delete_session(sid: str):
    """Déconnexion : supprime la session ; le panier survit avec son propre TTL."""
    redis_client().delete(f"session:{sid}")
    return Response(status_code=204)


@router.get("/cart")
def read_cart(x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    """Panier de la session, enrichi (nom, prix effectif MongoDB), total et TTL."""
    return _cart_view(get_session(x_session_id))


@router.post("/cart/items")
def add_item(body: ItemIn, x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    """Ajoute (incrémente) une ligne ; 404 si le SKU n'existe pas dans le catalogue."""
    s = get_session(x_session_id)
    if not mongo_db().products.count_documents({"_id": body.sku}, limit=1):
        raise HTTPException(404, "SKU inconnu")
    key = f"cart:{s['cart_id']}"
    pipe = redis_client().pipeline()  # MULTI/EXEC
    pipe.hincrby(key, body.sku, body.quantity)
    pipe.expire(key, _cart_ttl(s["cart_id"]))
    pipe.expire(f"session:{s['session_id']}", SESSION_TTL)
    pipe.execute()
    return _cart_view(s)


@router.put("/cart/items/{sku}")
def set_item(sku: str, body: QuantityIn, x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    """Fixe la quantité d'une ligne (0 = suppression)."""
    s = get_session(x_session_id)
    key = f"cart:{s['cart_id']}"
    if body.quantity == 0:
        redis_client().hdel(key, sku)
    else:
        if not mongo_db().products.count_documents({"_id": sku}, limit=1):
            raise HTTPException(404, "SKU inconnu")
        redis_client().hset(key, sku, body.quantity)
        redis_client().expire(key, _cart_ttl(s["cart_id"]))
    return _cart_view(s)


@router.delete("/cart/items/{sku}")
def remove_item(sku: str, x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    """Supprime une ligne ; 404 si absente du panier."""
    s = get_session(x_session_id)
    if not redis_client().hdel(f"cart:{s['cart_id']}", sku):
        raise HTTPException(404, "Ligne absente du panier")
    return _cart_view(s)


@router.post("/cart/checkout", status_code=201)
def checkout(x_session_id: str | None = Header(default=None, alias="X-Session-Id")):
    """Transforme le panier en commande (client connecté requis ; prix effectifs relus dans MongoDB).

    En production, la commande passe par le service transactionnel de commandes (base relationnelle) et un
    outbox publié sur Kafka alimente Cassandra et Neo4j ; ici, écritures directes (Cassandra puis Neo4j).
    """
    s = get_session(x_session_id)
    if not s.get("customer_id"):
        raise HTTPException(403, "Connexion requise pour passer commande")
    key = f"cart:{s['cart_id']}"
    lines = redis_client().hgetall(key)
    products = {p["_id"]: p for p in mongo_db().products.find({"_id": {"$in": list(lines)}}, {"name": 1, "price": 1, "promo": 1})}
    items = [{"sku": sku, "name": products[sku]["name"], "quantity": int(qty),
              "unit_price": effective_price(products[sku])[0]}
             for sku, qty in sorted(lines.items()) if sku in products]  # produit retiré : ligne ignorée
    if not items:
        raise HTTPException(400, "Panier vide")
    now = datetime.now(timezone.utc)
    order = {"customer_id": s["customer_id"], "order_id": f"CMD-{now:%Y%m%d}-{uuid.uuid4().hex[:6]}",
             "order_date": now, "status": "paid",
             "total": sum((i["quantity"] * i["unit_price"] for i in items), Decimal(0)), "items": items}
    analytics.record_order(order)
    reco.record_purchase(order)
    redis_client().delete(key)
    return to_json(order)
