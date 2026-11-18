"""Lot 4 — recommandations (Neo4j) : co-achats, compatibilité, similarité, filtrage collaboratif."""
from fastapi import APIRouter, HTTPException, Query

from app.db import neo4j_driver, to_json

router = APIRouter(prefix="/recommendations", tags=["Lot 4 — Recommandations (Neo4j)"])


def _rows(cypher: str, **params) -> list[dict]:
    records, _, _ = neo4j_driver().execute_query(cypher, parameters_=params, database_="neo4j")
    return [to_json(r.data()) for r in records]


def _require(label: str, key: str, value: str):
    if not _rows(f"MATCH (n:{label} {{{key}: $v}}) RETURN 1 AS ok", v=value):
        raise HTTPException(404, f"{label} introuvable : {value}")


@router.get("/customers/{customer_id}")
def for_customer(customer_id: str, limit: int = Query(5, ge=1, le=50)):
    """Filtrage collaboratif (3 sauts) : produits achetés par des clients aux achats communs, hors déjà achetés."""
    _require("Customer", "id", customer_id)
    return _rows(
        """MATCH (me:Customer {id: $cid})-[:PURCHASED]->(:Product)<-[:PURCHASED]-(peer:Customer)-[:PURCHASED]->(reco:Product)
           WHERE peer <> me AND NOT (me)-[:PURCHASED]->(reco)
           RETURN reco.sku AS sku, reco.name AS name, reco.price AS price, count(DISTINCT peer) AS score
           ORDER BY score DESC, sku LIMIT $limit""", cid=customer_id, limit=limit)


@router.get("/{sku}/also-bought")
def also_bought(sku: str, category: str | None = None, limit: int = Query(5, ge=1, le=50)):
    """« Ont aussi acheté » : 2 sauts via les clients, filtre de catégorie optionnel."""
    _require("Product", "sku", sku)
    return _rows(
        """MATCH (p:Product {sku: $sku})<-[:PURCHASED]-(c:Customer)-[:PURCHASED]->(o:Product)
           WHERE o <> p AND ($category IS NULL OR o.category = $category)
           RETURN o.sku AS sku, o.name AS name, o.price AS price, count(DISTINCT c) AS buyers
           ORDER BY buyers DESC, sku LIMIT $limit""", sku=sku, category=category, limit=limit)


@router.get("/{sku}/bought-together")
def bought_together(sku: str, limit: int = Query(5, ge=1, le=50)):
    """Achetés dans la même commande (BOUGHT_WITH pré-calculé, 1 saut, sans direction)."""
    _require("Product", "sku", sku)
    return _rows(
        """MATCH (:Product {sku: $sku})-[r:BOUGHT_WITH]-(o:Product)
           RETURN o.sku AS sku, o.name AS name, o.price AS price, r.count AS count
           ORDER BY count DESC, sku LIMIT $limit""", sku=sku, limit=limit)


@router.get("/{sku}/compatible")
def compatible(sku: str, category: str | None = None):
    """Produits compatibles : un standard commun avec des rôles opposés (USES / SUPPORTS)."""
    _require("Product", "sku", sku)
    return _rows(
        """MATCH (a:Product {sku: $sku})-[r1:USES|SUPPORTS]->(s:Standard)<-[r2:USES|SUPPORTS]-(b:Product)
           WHERE type(r1) <> type(r2) AND ($category IS NULL OR b.category = $category)
           RETURN b.category AS category, b.sku AS sku, b.name AS name, b.price AS price, collect(s.id) AS via
           ORDER BY category, sku""", sku=sku, category=category)


@router.get("/{sku}/similar")
def similar(sku: str, limit: int = Query(5, ge=1, le=50)):
    """Similaires : même catégorie, score 2*marque + 3*gamme + standards communs, puis écart de prix."""
    _require("Product", "sku", sku)
    return _rows(
        """MATCH (p:Product {sku: $sku})-[:IN_CATEGORY]->(:Category)<-[:IN_CATEGORY]-(o:Product) WHERE o <> p
           OPTIONAL MATCH (p)-[:MADE_BY]->(b)<-[:MADE_BY]-(o)
           OPTIONAL MATCH (p)-[:IN_RANGE]->(r)<-[:IN_RANGE]-(o)
           OPTIONAL MATCH (p)-[:USES|SUPPORTS]->(s:Standard)<-[:USES|SUPPORTS]-(o)
           WITH p, o, 2 * count(DISTINCT b) + 3 * count(DISTINCT r) + count(DISTINCT s) AS score
           RETURN o.sku AS sku, o.name AS name, o.price AS price, o.category AS category, score
           ORDER BY score DESC, abs(o.price - p.price), sku LIMIT $limit""", sku=sku, limit=limit)


def _write_purchase(tx, order: dict):
    cid, oid = order["customer_id"], order["order_id"]
    qty = {i["sku"]: i.get("quantity", 1) for i in order["items"]}
    skus = sorted(qty)
    tx.run("MERGE (:Customer {id: $cid})", cid=cid).consume()
    done = {r["sku"] for r in tx.run(
        "MATCH (:Customer {id: $cid})-[:PURCHASED {order_id: $oid}]->(p:Product) RETURN p.sku AS sku",
        cid=cid, oid=oid)}
    new = [s for s in skus if s not in done]  # lignes réellement créées par ce passage
    tx.run(
        """UNWIND $rows AS row
           MATCH (c:Customer {id: $cid}), (p:Product {sku: row.sku})
           MERGE (c)-[r:PURCHASED {order_id: $oid}]->(p)
           ON CREATE SET r.date = $date, r.quantity = row.quantity""",
        rows=[{"sku": s, "quantity": qty[s]} for s in new], cid=cid, oid=oid, date=order["order_date"]).consume()
    pairs = [{"a": a, "b": b} for i, a in enumerate(new) for b in new[i + 1:]]  # a < b (liste triée)
    tx.run(
        """UNWIND $pairs AS pair
           MATCH (a:Product {sku: pair.a}), (b:Product {sku: pair.b})
           MERGE (a)-[w:BOUGHT_WITH]->(b)
           ON CREATE SET w.count = 1
           ON MATCH SET w.count = w.count + 1""", pairs=pairs).consume()


def record_purchase(order: dict):
    """Enregistre une commande (forme `seed.synthetic_orders`) ; idempotent : un rejeu n'incrémente rien."""
    with neo4j_driver().session(database="neo4j") as session:
        session.execute_write(_write_purchase, order)
