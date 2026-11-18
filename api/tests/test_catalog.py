import pytest

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
