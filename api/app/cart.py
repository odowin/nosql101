"""Lot 2 — Sessions et paniers (Redis, TTL glissants) ; prix courants lus dans MongoDB."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, Field

from app.db import mongo_db, redis_client

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
    """Panier enrichi du prix courant MongoDB ; rafraîchit les TTL (glissant)."""
    cart_id, key = session["cart_id"], f"cart:{session['cart_id']}"
    pipe = redis_client().pipeline()
    pipe.hgetall(key)
    pipe.expire(key, _cart_ttl(cart_id))
    pipe.expire(f"session:{session['session_id']}", SESSION_TTL)
    pipe.ttl(key)
    lines, _, _, ttl = pipe.execute()
    products = {p["_id"]: p for p in mongo_db().products.find({"_id": {"$in": list(lines)}}, {"name": 1, "price": 1})}
    items, total = [], Decimal(0)
    for sku, qty in sorted(lines.items()):
        p = products.get(sku)
        if p is None:  # produit retiré du catalogue : ligne ignorée
            continue
        qty = int(qty)
        unit = p["price"].to_decimal()
        total += unit * qty
        items.append({"sku": sku, "name": p["name"], "unit_price": float(unit),
                      "quantity": qty, "line_total": float(unit * qty)})
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
    """Panier de la session, enrichi (nom, prix courant MongoDB), total et TTL."""
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
