"""Seed idempotent des bases à partir de `data/catalog.json` (lancé au démarrage : `python -m app.seed`)."""
import json
import random
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from itertools import combinations
from pathlib import Path

from bson import Decimal128, ObjectId
from cassandra.concurrent import execute_concurrent_with_args

from app.analytics import prepared, record_order, shard_of
from app.catalog import compatible_for
from app.db import cassandra_session, mongo_db, neo4j_driver, redis_client

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalog.json"


def load_catalog() -> dict:
    """Jeu de démo : {categories, brands, products, reviews, bundles}."""
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def _wait(name, check, timeout=180):
    deadline = time.monotonic() + timeout
    while True:
        try:
            check()
            print(f"[seed] {name} ok")
            return
        except Exception as e:
            if time.monotonic() > deadline:
                raise
            print(f"[seed] attente {name} : {e}")
            time.sleep(3)


def wait_for_dbs():
    _wait("mongodb", lambda: mongo_db().command("ping"))
    _wait("redis", lambda: redis_client().ping())
    cassandra_session()  # réessaie lui-même ~3 min
    print("[seed] cassandra ok")
    _wait("neo4j", lambda: neo4j_driver().verify_connectivity())


def seed_mongo(data: dict):
    db = mongo_db()
    if db.products.count_documents({}) >= len(data["products"]):
        print("[seed] mongodb déjà peuplé, ignoré")
        return
    now = datetime.now(timezone.utc)
    categories = {c["_id"]: c for c in data["categories"]}
    brands = {b["_id"]: b for b in data["brands"]}
    for coll in (db.categories, db.brands, db.reviews, db.products):  # remplace le jeu d'exemple d'init.js
        coll.delete_many({})
    db.categories.insert_many(data["categories"])
    db.brands.insert_many(data["brands"])

    reviews = [{"_id": ObjectId(), **r, "created_at": datetime.fromisoformat(r["created_at"])}
               for r in data["reviews"]]
    products = []
    for p in data["products"]:
        cat, brand = categories[p["category"]], brands[p["brand"]]
        own = sorted((r for r in reviews if r["product_id"] == p["_id"]),
                     key=lambda r: r["created_at"], reverse=True)
        total = sum(r["rating"] for r in own)
        products.append({
            **p,
            "category": {"_id": cat["_id"], "name": cat["name"], "path": "/".join(cat["ancestors"] + [cat["_id"]])},
            "brand": {"_id": brand["_id"], "name": brand["name"]},
            "price": Decimal128(str(p["price"])),
            "rating": {"avg": round(total / len(own), 2) if own else 0, "count": len(own), "sum": total},
            "top_reviews": [{k: r[k] for k in ("_id", "author", "rating", "title", "comment", "created_at")}
                            for r in own[:3]],
            "compatible": [],
            "schema_version": 1,
            "created_at": now,
            "updated_at": now,
        })
    db.products.insert_many(products)
    db.reviews.insert_many(reviews)
    # Subset `compatible` calculé une fois tous les produits présents.
    for p in products:
        db.products.update_one({"_id": p["_id"]}, {"$set": {"compatible": compatible_for(p["_id"], p["compat"])}})
    print(f"[seed] mongodb : {len(products)} produits, {len(reviews)} avis")


def synthetic_orders(data: dict) -> list[dict]:
    """Commandes synthétiques déterministes de C0001..C0060 (réutilisées par le seed Neo4j)."""
    rng = random.Random(42)
    prices = {p["_id"]: (p["name"], Decimal(str(p["price"]))) for p in data["products"]}
    anchor = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    orders = []
    for n in range(1, 61):
        for _ in range(rng.randint(1, 3)):
            bundle = rng.choice(data["bundles"])
            skus = rng.sample(bundle, rng.randint(2, len(bundle)))
            if rng.random() < 0.3:
                extra = rng.choice(list(prices))
                if extra not in skus:
                    skus.append(extra)
            items = [{"sku": s, "name": prices[s][0], "quantity": rng.choices([1, 2], [9, 1])[0],
                      "unit_price": prices[s][1]} for s in skus]
            date = anchor - timedelta(days=rng.randint(0, 539), seconds=rng.randint(0, 86399))
            orders.append({
                "customer_id": f"C{n:04d}",
                "order_id": f"CMD-{date:%Y%m%d}-{rng.getrandbits(24):06x}",
                "order_date": date,
                "status": "delivered" if (anchor - date).days > 7 else rng.choice(["shipped", "paid"]),
                "total": sum(i["quantity"] * i["unit_price"] for i in items),
                "items": items,
            })
    return orders


SEARCHES = {"rtx 5070": 42, "ryzen 7": 35, "ddr5 32go": 28, "ssd nvme 2to": 19,
            "alimentation 850w": 11, "clavier mecanique": 8}


def seed_cassandra(data: dict):
    """Commandes + compteurs de vues/recherches (non idempotents : gardés par le marqueur `orders_by_id`)."""
    session = cassandra_session()
    if session.execute("SELECT order_id FROM orders_by_id LIMIT 1").one():
        print("[seed] cassandra déjà peuplé, ignoré")
        return
    orders = synthetic_orders(data)
    for o in orders:
        record_order(o)
    rng = random.Random(42)
    in_bundle = {s for b in data["bundles"] for s in b}
    today = datetime.now(timezone.utc).date()
    by_day, by_shard = [], []
    for offset in range(14):
        day = today - timedelta(days=offset)
        for p in data["products"]:
            sku = p["_id"]
            n = rng.randint(3, 25) * (4 if p["category"] in ("gpu", "cpu") else 1) * (2 if sku in in_bundle else 1)
            by_day.append((n, sku, day))
            by_shard.append((n, day, shard_of(sku), sku))
    execute_concurrent_with_args(
        session, prepared("UPDATE product_views_by_day SET views = views + ? WHERE sku=? AND day=?"), by_day)
    execute_concurrent_with_args(
        session, prepared("UPDATE daily_views_by_shard SET views = views + ? WHERE day=? AND shard=? AND sku=?"), by_shard)
    execute_concurrent_with_args(
        session, prepared("UPDATE searches_by_day SET searches = searches + ? WHERE day=? AND shard=? AND search_query=?"),
        [(n, today, shard_of(q), q) for q, n in SEARCHES.items()])
    print(f"[seed] cassandra : {len(orders)} commandes, {len(by_day)} compteurs de vues")


def seed_neo4j(data: dict):
    """Projection du catalogue Mongo + commandes synthétiques dans Neo4j (ignoré si des produits existent)."""
    driver = neo4j_driver()

    def run_q(cypher, **params):
        driver.execute_query(cypher, parameters_=params, database_="neo4j")

    if driver.execute_query("MATCH (p:Product) RETURN p LIMIT 1", database_="neo4j").records:
        print("[seed] neo4j déjà peuplé, ignoré")
        return
    db = mongo_db()
    cats = [{"id": c["_id"], "name": c["name"], "parent": c.get("parent")} for c in db.categories.find()]
    run_q("UNWIND $cats AS c MERGE (n:Category {id: c.id}) SET n.name = c.name", cats=cats)
    run_q("""UNWIND $cats AS c WITH c WHERE c.parent IS NOT NULL
             MATCH (a:Category {id: c.id}), (b:Category {id: c.parent}) MERGE (a)-[:CHILD_OF]->(b)""", cats=cats)
    rows = []
    for p in db.products.find():
        compat = p.get("compat", {})
        rows.append({
            "sku": p["_id"], "name": p["name"], "price": float(p["price"].to_decimal()),
            "category": p["category"]["_id"], "brand": p["brand"]["_id"], "brand_name": p["brand"]["name"],
            "range": p.get("range"),
            "uses": [{"id": k, "kind": k.split(":")[0]} for k in compat.get("uses", [])],
            "supports": [{"id": k, "kind": k.split(":")[0]} for k in compat.get("supports", [])],
        })
    run_q("""UNWIND $rows AS r
             MERGE (p:Product {sku: r.sku})
             SET p.name = r.name, p.price = r.price, p.category = r.category, p.brand = r.brand
             WITH p, r
             MATCH (c:Category {id: r.category}) MERGE (p)-[:IN_CATEGORY]->(c)
             MERGE (b:Brand {id: r.brand}) SET b.name = r.brand_name
             MERGE (p)-[:MADE_BY]->(b)
             FOREACH (_ IN CASE WHEN r.range IS NULL THEN [] ELSE [1] END |
                 MERGE (g:Range {name: r.range}) MERGE (p)-[:IN_RANGE]->(g))
             FOREACH (s IN r.uses |
                 MERGE (st:Standard {id: s.id}) SET st.kind = s.kind, st.name = s.id MERGE (p)-[:USES]->(st))
             FOREACH (s IN r.supports |
                 MERGE (st:Standard {id: s.id}) SET st.kind = s.kind, st.name = s.id MERGE (p)-[:SUPPORTS]->(st))""",
          rows=rows)
    orders = synthetic_orders(data)
    run_q("""UNWIND $rows AS r
             MERGE (c:Customer {id: r.cid})
             WITH c, r MATCH (p:Product {sku: r.sku})
             MERGE (c)-[x:PURCHASED {order_id: r.oid}]->(p) SET x.date = r.date, x.quantity = r.qty""",
          rows=[{"cid": o["customer_id"], "oid": o["order_id"], "sku": i["sku"], "date": o["order_date"],
                 "qty": i["quantity"]} for o in orders for i in o["items"]])
    pairs = Counter((a, b) for o in orders for a, b in combinations(sorted({i["sku"] for i in o["items"]}), 2))
    run_q("""UNWIND $pairs AS r
             MATCH (a:Product {sku: r.a}), (b:Product {sku: r.b})
             MERGE (a)-[w:BOUGHT_WITH]->(b) SET w.count = r.count""",
          pairs=[{"a": a, "b": b, "count": n} for (a, b), n in pairs.items()])
    print(f"[seed] neo4j : {len(rows)} produits, {len(orders)} commandes, {len(pairs)} paires BOUGHT_WITH")


def run():
    wait_for_dbs()
    data = load_catalog()
    seed_mongo(data)
    seed_cassandra(data)
    seed_neo4j(data)


if __name__ == "__main__":
    run()
