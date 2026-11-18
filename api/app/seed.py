"""Seed idempotent des bases à partir de `data/catalog.json` (lancé au démarrage : `python -m app.seed`)."""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from bson import Decimal128, ObjectId

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


def run():
    wait_for_dbs()
    data = load_catalog()
    seed_mongo(data)
    # T5 : seed_cassandra(data) ; T6 : seed_neo4j(data)


if __name__ == "__main__":
    run()
