"""Lot 3 — événements, compteurs, classements et historique des commandes (Cassandra)."""
import uuid
import zlib
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from functools import lru_cache

from cassandra import ConsistencyLevel
from cassandra.query import BatchStatement, BatchType
from cassandra.util import datetime_from_uuid1
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import cassandra_session, mongo_db, to_json

router = APIRouter(tags=["Lot 3 — Logs & analytics (Cassandra)"])

SHARDS = 8


def shard_of(x: str) -> int:
    """Shard stable (0..7) d'une clé de partition."""
    return zlib.crc32(x.encode()) % SHARDS


@lru_cache
def prepared(cql: str, consistency=None):
    """Prépare (une fois) une requête CQL, avec un niveau de cohérence optionnel."""
    stmt = cassandra_session().prepare(cql)
    if consistency is not None:
        stmt.consistency_level = consistency
    return stmt


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _run(cql, params=(), cl=None):
    return cassandra_session().execute(prepared(cql, cl), params)


def top_n(rows, limit):
    """Fusionne des lignes (clé, compteur) de plusieurs jours/shards → top `limit` décroissant."""
    total = Counter()
    for key, n in rows:
        total[key] += n
    return sorted(total.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]


# --- Événements -------------------------------------------------------------

class EventType(str, Enum):
    page_view = "page_view"
    product_view = "product_view"
    click = "click"
    search = "search"
    add_to_cart = "add_to_cart"


class Event(BaseModel):
    event_type: EventType
    session_id: str
    customer_id: str | None = None
    sku: str | None = None
    url: str | None = None
    search_query: str | None = None


@router.post("/events", status_code=202)
def post_event(e: Event):
    """Collecte un événement (écritures `ONE`) et met à jour les compteurs."""
    if e.event_type == EventType.product_view and not e.sku:
        raise HTTPException(422, "sku requis pour product_view")
    if e.event_type == EventType.search and not e.search_query:
        raise HTTPException(422, "search_query requis pour search")
    event_id = uuid.uuid1()
    now = datetime.now(timezone.utc)
    day = now.date()
    one = ConsistencyLevel.ONE
    _run("INSERT INTO events_by_hour (day, hour, shard, event_id, event_type, session_id, customer_id, sku, url, search_query) "
         "VALUES (?,?,?,?,?,?,?,?,?,?)",
         (day, now.hour, shard_of(e.session_id), event_id, e.event_type.value, e.session_id,
          e.customer_id, e.sku, e.url, e.search_query), one)
    _run("INSERT INTO events_by_session (session_id, event_id, event_type, customer_id, sku, url, search_query) "
         "VALUES (?,?,?,?,?,?,?)",
         (e.session_id, event_id, e.event_type.value, e.customer_id, e.sku, e.url, e.search_query), one)
    if e.event_type == EventType.product_view:
        _run("UPDATE product_views_by_day SET views = views + 1 WHERE sku=? AND day=?", (e.sku, day), one)
        _run("UPDATE daily_views_by_shard SET views = views + 1 WHERE day=? AND shard=? AND sku=?",
             (day, shard_of(e.sku), e.sku), one)
    if e.event_type == EventType.search:
        _run("UPDATE searches_by_day SET searches = searches + 1 WHERE day=? AND shard=? AND search_query=?",
             (day, shard_of(e.search_query), e.search_query), one)
    return {"event_id": str(event_id)}


@router.get("/analytics/sessions/{sid}/events")
def session_events(sid: str):
    """Parcours d'une session, dans l'ordre chronologique."""
    rows = _run("SELECT event_id, event_type, customer_id, sku, url, search_query "
                "FROM events_by_session WHERE session_id=?", (sid,))
    return [{"event_id": str(r.event_id),
             "timestamp": datetime_from_uuid1(r.event_id).replace(tzinfo=timezone.utc).isoformat(),
             "event_type": r.event_type, "customer_id": r.customer_id, "sku": r.sku,
             "url": r.url, "search_query": r.search_query} for r in rows]


# --- Analytics --------------------------------------------------------------

@router.get("/analytics/products/{sku}/views")
def product_views(sku: str, day: date | None = None):
    """Q1 : vues d'un produit un jour donné (défaut : aujourd'hui UTC)."""
    day = day or _today()
    row = _run("SELECT views FROM product_views_by_day WHERE sku=? AND day=?", (sku, day)).one()
    return {"sku": sku, "day": day.isoformat(), "views": row.views if row else 0}


@router.get("/analytics/products/{sku}/views/daily")
def product_views_daily(sku: str, days: int = Query(7, ge=1, le=90)):
    """Série journalière des vues, du plus récent au plus ancien."""
    since = _today() - timedelta(days=days - 1)
    rows = _run("SELECT day, views FROM product_views_by_day WHERE sku=? AND day>=?", (sku, since))
    return [{"day": str(r.day), "views": r.views} for r in rows]


def _read_shards(table, cols, days):
    """Lignes (clé, compteur) des 8 shards pour chaque jour."""
    cql = f"SELECT {cols[0]}, {cols[1]} FROM {table} WHERE day=? AND shard=?"
    return [tuple(r) for d in days for s in range(SHARDS) for r in _run(cql, (d, s))]


@router.get("/analytics/top-products")
def top_products(period: str = Query("day", pattern="^(day|week)$"), limit: int = Query(10, ge=1, le=100)):
    """Q2 : top produits du jour ou de la semaine ISO en cours (recalcul + upsert du classement)."""
    today = _today()
    if period == "day":
        days, key = [today], f"day:{today.isoformat()}"
    else:
        monday = today - timedelta(days=today.weekday())
        days = [monday + timedelta(days=i) for i in range((today - monday).days + 1)]
        y, w, _ = today.isocalendar()
        key = f"week:{y}-W{w:02d}"
    ranking = top_n(_read_shards("daily_views_by_shard", ("sku", "views"), days), 100)
    computed_at = datetime.now(timezone.utc)
    ins = prepared("INSERT INTO top_products_by_period (period, rank, sku, views, computed_at) VALUES (?,?,?,?,?)")
    batch = BatchStatement(BatchType.UNLOGGED)  # une seule partition
    for rank, (sku, views) in enumerate(ranking, 1):
        batch.add(ins, (key, rank, sku, views, computed_at))
    if ranking:
        cassandra_session().execute(batch)
    top = ranking[:limit]
    names = {p["_id"]: p["name"] for p in mongo_db().products.find({"_id": {"$in": [s for s, _ in top]}}, {"name": 1})}
    return {"period": key, "computed_at": computed_at.isoformat(),
            "items": [{"rank": i, "sku": s, "name": names.get(s), "views": v} for i, (s, v) in enumerate(top, 1)]}


@router.get("/analytics/top-searches")
def top_searches(limit: int = Query(10, ge=1, le=100)):
    """Top des recherches du jour."""
    rows = _read_shards("searches_by_day", ("search_query", "searches"), [_today()])
    return [{"search_query": q, "searches": n} for q, n in top_n(rows, limit)]


# --- Commandes --------------------------------------------------------------

def _order_json(r):
    return to_json({"order_id": r.order_id, "customer_id": r.customer_id, "order_date": r.order_date,
                    "status": r.status, "total": r.total,
                    "items": [i._asdict() for i in (r.items or [])]})


@router.get("/customers/{customer_id}/orders")
def customer_orders(customer_id: str, limit: int = Query(20, ge=1, le=200)):
    """Q3 : historique des commandes d'un client, plus récentes d'abord."""
    rows = _run("SELECT * FROM orders_by_customer WHERE customer_id=? LIMIT ?", (customer_id, limit))
    return [_order_json(r) for r in rows]


@router.get("/orders/{order_id}")
def order_detail(order_id: str):
    """Détail d'une commande."""
    row = _run("SELECT * FROM orders_by_id WHERE order_id=?", (order_id,)).one()
    if not row:
        raise HTTPException(404, "Commande introuvable")
    return _order_json(row)


def record_order(order: dict):
    """Écrit une commande dans les 2 tables (BATCH loggé, QUORUM).

    order : customer_id, order_id, order_date (datetime UTC), status, total, items[{sku, name, quantity, unit_price}].
    """
    items = [(i["sku"], i["name"], i["quantity"], Decimal(str(i["unit_price"]))) for i in order["items"]]
    vals = (order["order_id"], order["customer_id"], order["order_date"], order["status"],
            Decimal(str(order["total"])), items)
    cql = "INSERT INTO {} (order_id, customer_id, order_date, status, total, items) VALUES (?,?,?,?,?,?)"
    batch = BatchStatement(BatchType.LOGGED, consistency_level=ConsistencyLevel.QUORUM)
    batch.add(prepared(cql.format("orders_by_customer")), vals)
    batch.add(prepared(cql.format("orders_by_id")), vals)
    cassandra_session().execute(batch)
