import uuid

import pytest
from bson import Decimal128

from app.db import mongo_db, redis_client

SKU_A, SKU_B = "CPU-TEST-CART-A", "CPU-TEST-CART-B"
PRICES = {SKU_A: "100.10", SKU_B: "20.05"}


@pytest.fixture(scope="module", autouse=True)
def products():
    for sku, price in PRICES.items():
        mongo_db().products.replace_one({"_id": sku}, {
            "_id": sku, "name": f"Produit {sku}", "slug": sku.lower(), "price": Decimal128(price),
            "category": {"_id": "cpu", "name": "Processeurs", "path": "informatique/composants/cpu"},
            "brand": {"_id": "amd", "name": "AMD"},
        }, upsert=True)
    yield
    mongo_db().products.delete_many({"_id": {"$in": list(PRICES)}})


@pytest.fixture
def session(client):
    """Session fraîche ; nettoie les clés Redis créées."""
    s = client.post("/sessions").json()
    s["customer_id"] = f"TEST-CUST-{uuid.uuid4().hex[:8]}"
    s["headers"] = {"X-Session-Id": s["session_id"]}
    yield s
    redis_client().delete(f"session:{s['session_id']}", f"cart:{s['cart_id']}",
                          f"cart:customer:{s['customer_id']}")


def test_create_session(client, session):
    assert session["cart_id"].startswith("anon:")
    assert 0 < session["ttl"] <= 1800
    assert 0 < redis_client().ttl(f"session:{session['session_id']}") <= 1800
    assert client.get(f"/sessions/{session['session_id']}").json()["cart_id"] == session["cart_id"]


def test_add_item_and_increment(client, session):
    r = client.post("/cart/items", json={"sku": SKU_A, "quantity": 2}, headers=session["headers"])
    assert r.status_code == 200
    assert redis_client().hget(f"cart:{session['cart_id']}", SKU_A) == "2"
    assert 6 * 86400 < redis_client().ttl(f"cart:{session['cart_id']}") <= 7 * 86400
    r = client.post("/cart/items", json={"sku": SKU_A, "quantity": 3}, headers=session["headers"])
    assert r.json()["items"][0]["quantity"] == 5


def test_unknown_sku_and_missing_header(client, session):
    assert client.post("/cart/items", json={"sku": "NOPE-NOPE", "quantity": 1},
                       headers=session["headers"]).status_code == 404
    assert client.get("/cart").status_code == 401
    assert client.get("/cart", headers={"X-Session-Id": "inconnue"}).status_code == 401


def test_put_zero_and_delete(client, session):
    h = session["headers"]
    client.post("/cart/items", json={"sku": SKU_A, "quantity": 1}, headers=h)
    client.post("/cart/items", json={"sku": SKU_B, "quantity": 1}, headers=h)
    r = client.put(f"/cart/items/{SKU_A}", json={"quantity": 0}, headers=h)
    assert [i["sku"] for i in r.json()["items"]] == [SKU_B]
    r = client.put(f"/cart/items/{SKU_B}", json={"quantity": 4}, headers=h)
    assert r.json()["items"][0]["quantity"] == 4
    assert client.delete(f"/cart/items/{SKU_B}", headers=h).json()["items"] == []
    assert client.delete(f"/cart/items/{SKU_B}", headers=h).status_code == 404


def test_cart_total_uses_current_price(client, session):
    h = session["headers"]
    client.post("/cart/items", json={"sku": SKU_A, "quantity": 2}, headers=h)
    client.post("/cart/items", json={"sku": SKU_B, "quantity": 3}, headers=h)
    cart = client.get("/cart", headers=h).json()
    assert cart["total"] == pytest.approx(2 * 100.10 + 3 * 20.05)
    assert cart["total"] == pytest.approx(sum(i["line_total"] for i in cart["items"]))
    mongo_db().products.update_one({"_id": SKU_A}, {"$set": {"price": Decimal128("110.00")}})
    try:
        assert client.get("/cart", headers=h).json()["total"] == pytest.approx(2 * 110 + 3 * 20.05)
    finally:
        mongo_db().products.update_one({"_id": SKU_A}, {"$set": {"price": Decimal128(PRICES[SKU_A])}})


def test_login_merges_carts(client, session):
    h, cust = session["headers"], session["customer_id"]
    r = redis_client()
    r.hset(f"cart:customer:{cust}", SKU_A, 1)  # panier client préexistant
    client.post("/cart/items", json={"sku": SKU_A, "quantity": 2}, headers=h)
    client.post("/cart/items", json={"sku": SKU_B, "quantity": 1}, headers=h)
    resp = client.post(f"/sessions/{session['session_id']}/login", json={"customer_id": cust})
    assert resp.status_code == 200
    assert r.hgetall(f"cart:customer:{cust}") == {SKU_A: "3", SKU_B: "1"}
    assert not r.exists(f"cart:{session['cart_id']}")
    assert 29 * 86400 < r.ttl(f"cart:customer:{cust}") <= 30 * 86400
    s = client.get(f"/sessions/{session['session_id']}").json()
    assert s["cart_id"] == f"customer:{cust}" and s["customer_id"] == cust
    assert client.get("/cart", headers=h).json()["cart_id"] == f"customer:{cust}"


def test_delete_session(client, session):
    sid = session["session_id"]
    assert client.delete(f"/sessions/{sid}").status_code == 204
    assert client.get(f"/sessions/{sid}").status_code == 404
