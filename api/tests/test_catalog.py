from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from bson import Decimal128

from app.catalog import effective_price
from app.db import mongo_db, redis_client

TEST_SKU = "CPU-AMD-TEST-NPU"


def _cleanup():
    mongo_db().products.delete_one({"_id": TEST_SKU})
    mongo_db().reviews.delete_many({"product_id": TEST_SKU})
    redis_client().delete(f"product:{TEST_SKU}")


@pytest.fixture
def new_product(client):
    _cleanup()
    r = client.post("/products", json={
        "_id": TEST_SKU, "name": "AMD Ryzen AI Test", "category": "cpu", "brand": "amd",
        "price": 399.9, "slug": "amd-ryzen-ai-test",
        "specs": [{"k": "cores", "label": "Cœurs", "v": 8}],
        "compat": {"uses": ["socket:AM5"], "supports": []},
        "npu_tops": 50,  # attribut inédit : aucune migration nécessaire
    })
    assert r.status_code == 201, r.text
    yield r.json()
    _cleanup()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"mongodb": "ok", "redis": "ok", "cassandra": "ok", "neo4j": "ok"}


def test_categories_tree(client):
    roots = client.get("/categories").json()
    assert [c["_id"] for c in roots] == ["informatique"]


def test_list_by_category(client):
    body = client.get("/products", params={"category": "cpu", "limit": 100}).json()
    assert body["total"] >= 5
    assert all(p["category"]["_id"] == "cpu" for p in body["items"])
    assert all("specs" not in p and "top_reviews" not in p for p in body["items"])
    assert all(isinstance(p["price"], float) for p in body["items"])


def test_spec_filter_socket_am5(client):
    items = client.get("/products", params={"spec": "socket:AM5", "limit": 100}).json()["items"]
    skus = {p["_id"] for p in items}
    assert {"CPU-AMD-R7-9800X3D", "MB-MSI-X870-TOMAHAWK"} <= skus
    assert all(p["category"]["_id"] in ("cpu", "motherboard") for p in items)
    for p in mongo_db().products.find({"_id": {"$in": list(skus)}}):
        assert {"k": "socket", "v": "AM5"} in [{"k": s["k"], "v": s["v"]} for s in p["specs"]]


def test_price_and_numeric_spec_filters(client):
    items = client.get("/products", params={
        "category": "cpu", "min_price": 400, "max_price": 600, "spec": "cores:8", "limit": 100}).json()["items"]
    assert "CPU-AMD-R7-9800X3D" in {p["_id"] for p in items}
    assert all(400 <= p["price"] <= 600 for p in items)


def test_product_detail_cache(client):
    sku = "CPU-AMD-R7-9800X3D"
    redis_client().delete(f"product:{sku}")
    first = client.get(f"/products/{sku}")
    assert first.status_code == 200 and first.headers["X-Cache"] == "MISS"
    second = client.get(f"/products/{sku}")
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == first.json()
    assert first.json()["category"]["path"] == "informatique/composants/cpu"
    assert 0 < redis_client().ttl(f"product:{sku}") <= 300


def test_product_unknown(client):
    assert client.get("/products/NOPE").status_code == 404


def test_create_product_new_attribute(client, new_product):
    assert new_product["brand"] == {"_id": "amd", "name": "AMD"}
    assert new_product["compatible"]  # cartes mères / ventirads AM5
    got = client.get(f"/products/{TEST_SKU}").json()
    assert got["npu_tops"] == 50
    assert got["price"] == 399.9
    dup = client.post("/products", json={"_id": TEST_SKU, "name": "x", "category": "cpu", "brand": "amd", "price": 1})
    assert dup.status_code == 409
    bad = client.post("/products", json={"_id": "X-1", "name": "x", "category": "nope", "brand": "amd", "price": 1})
    assert bad.status_code == 400


def test_post_review_updates_rating_and_cache(client, new_product):
    client.get(f"/products/{TEST_SKU}")  # met la fiche en cache
    ratings = [5, 4, 3, 5]
    posted = []
    for i, rating in enumerate(ratings):
        r = client.post(f"/products/{TEST_SKU}/reviews", json={
            "customer_id": "C0001", "author": "Testeur", "rating": rating,
            "title": f"Avis {i}", "comment": "RAS"})
        assert r.status_code == 201, r.text
        posted.append(r.json())
    assert not redis_client().exists(f"product:{TEST_SKU}")  # cache invalidé

    detail = client.get(f"/products/{TEST_SKU}")
    assert detail.headers["X-Cache"] == "MISS"
    p = detail.json()
    assert p["rating"] == {"avg": 4.25, "count": 4, "sum": 17}
    top = p["top_reviews"]
    assert len(top) == 3
    dates = [t["created_at"] for t in top]
    assert dates == sorted(dates, reverse=True)
    assert posted[-1]["_id"] in [t["_id"] for t in top]

    reviews = client.get(f"/products/{TEST_SKU}/reviews", params={"limit": 2}).json()
    assert reviews["total"] == 4 and len(reviews["items"]) == 2
    assert client.post(f"/products/{TEST_SKU}/reviews", json={
        "customer_id": "C0001", "author": "x", "rating": 6, "title": "x", "comment": "x"}).status_code == 422


NOW = datetime(2026, 11, 27, 12, tzinfo=timezone.utc)
DAY = timedelta(days=1)


def _promo(start, end, **kw):
    return {"label": "Black Friday", "starts_at": NOW + start * DAY, "ends_at": NOW + end * DAY, **kw}


@pytest.mark.parametrize("product, expected", [
    ({"price": Decimal128("100.00")}, (Decimal("100.00"), None, False)),  # sans promo
    ({"price": Decimal128("100.00"), "promo": _promo(-1, 1, percent=15)}, (Decimal("85.00"), 15, True)),
    ({"price": Decimal128("100.00"), "promo": _promo(-1, 1, price=Decimal128("79.90"))}, (Decimal("79.90"), 20, True)),
    ({"price": Decimal128("100.00"), "promo": _promo(1, 2, percent=15)}, (Decimal("100.00"), None, False)),  # à venir
    ({"price": Decimal128("100.00"), "promo": _promo(-2, -1, percent=15)}, (Decimal("100.00"), None, False)),  # expirée
    ({"price": Decimal128("100.00"), "promo": _promo(0, 1, percent=15)}, (Decimal("85.00"), 15, True)),  # starts_at inclus
    ({"price": Decimal128("100.00"), "promo": _promo(-1, 0, percent=15)}, (Decimal("100.00"), None, False)),  # ends_at exclu
    ({"price": Decimal128("489.95"), "promo": _promo(-1, 1, percent=15)}, (Decimal("416.46"), 15, True)),  # 416.4575
    ({"price": Decimal128("0.10"), "promo": _promo(-1, 1, percent=25)}, (Decimal("0.08"), 25, True)),  # 0.075 : demi au-dessus
])
def test_effective_price(product, expected):
    assert effective_price(product, NOW) == expected


def test_effective_price_from_cached_json():
    cached = {"price": 100.0, "promo": {"label": "x", "percent": 15, "starts_at": (NOW - DAY).isoformat(),
                                        "ends_at": (NOW + DAY).isoformat()}}
    assert effective_price(cached, NOW) == (Decimal("85.00"), 15, True)


PROMO_SKUS = {"CPU-TEST-PROMO-ON": (-1, 1), "CPU-TEST-PROMO-OLD": (-2, -1)}


@pytest.fixture
def promo_products():
    now = datetime.now(timezone.utc)
    for sku, (start, end) in PROMO_SKUS.items():
        mongo_db().products.replace_one({"_id": sku}, {
            "_id": sku, "name": f"Produit {sku}", "slug": sku.lower(), "price": Decimal128("200.00"),
            "category": {"_id": "cpu", "name": "Processeurs", "path": "informatique/composants/cpu"},
            "brand": {"_id": "amd", "name": "AMD"},
            "promo": {"label": "Test", "percent": 10, "starts_at": now + start * DAY, "ends_at": now + end * DAY},
        }, upsert=True)
    yield
    mongo_db().products.delete_many({"_id": {"$in": list(PROMO_SKUS)}})
    redis_client().delete(*[f"product:{s}" for s in PROMO_SKUS])


def test_on_sale_filter_and_effective_price(client, promo_products):
    items = client.get("/products", params={"on_sale": "true", "limit": 100}).json()["items"]
    by_sku = {p["_id"]: p for p in items}
    assert "CPU-TEST-PROMO-ON" in by_sku and "CPU-TEST-PROMO-OLD" not in by_sku
    assert all(p["on_sale"] for p in items)
    on = by_sku["CPU-TEST-PROMO-ON"]
    assert (on["price"], on["effective_price"], on["discount_percent"]) == (200.0, 180.0, 10)
    assert on["promo"]["label"] == "Test"
    for _ in range(2):  # MISS puis HIT : le prix effectif est recalculé depuis le cache
        old = client.get("/products/CPU-TEST-PROMO-OLD").json()
        assert (old["effective_price"], old["on_sale"], old["discount_percent"]) == (200.0, False, None)
    both = client.post("/products", json={
        "_id": "X-PROMO", "name": "x", "category": "cpu", "brand": "amd", "price": 100,
        "promo": {"label": "x", "percent": 10, "price": 90, "starts_at": NOW.isoformat(),
                  "ends_at": (NOW + DAY).isoformat()}})
    assert both.status_code == 422
