import uuid
from datetime import datetime, timezone

from app.analytics import shard_of, top_n
from app.db import cassandra_session

SKU = "CPU-AMD-R7-9800X3D"


def test_shard_of():
    assert shard_of("abc") == shard_of("abc")
    assert {shard_of(f"s{i}") for i in range(200)} <= set(range(8))
    assert len({shard_of(f"s{i}") for i in range(200)}) > 1


def test_top_n():
    rows = [("a", 5), ("b", 3), ("a", 2), ("c", 10), ("b", 1)]  # plusieurs jours/shards
    assert top_n(rows, 10) == [("c", 10), ("a", 7), ("b", 4)]
    assert top_n(rows, 2) == [("c", 10), ("a", 7)]


def _post(client, **body):
    r = client.post("/events", json=body)
    assert r.status_code == 202, r.text
    return r.json()["event_id"]


def test_product_view_increments_q1(client):
    before = client.get(f"/analytics/products/{SKU}/views").json()["views"]
    _post(client, event_type="product_view", session_id="s-q1", sku=SKU)
    after = client.get(f"/analytics/products/{SKU}/views").json()
    assert after["views"] == before + 1
    today = datetime.now(timezone.utc).date().isoformat()
    daily = client.get(f"/analytics/products/{SKU}/views/daily?days=7").json()
    assert daily[0]["day"] == today
    assert [d["day"] for d in daily] == sorted((d["day"] for d in daily), reverse=True)


def test_product_view_requires_sku(client):
    r = client.post("/events", json={"event_type": "product_view", "session_id": "s-x"})
    assert r.status_code == 422


def test_top_products_week(client):
    r = client.get("/analytics/top-products?period=week&limit=5")
    assert r.status_code == 200
    body = r.json()
    items = body["items"]
    assert 0 < len(items) <= 5
    views = [i["views"] for i in items]
    assert views == sorted(views, reverse=True)
    assert [i["rank"] for i in items] == list(range(1, len(items) + 1))
    assert items[0]["name"]
    row = cassandra_session().execute(
        "SELECT sku, views FROM top_products_by_period WHERE period=%s AND rank=1", (body["period"],)).one()
    assert (row.sku, row.views) == (items[0]["sku"], items[0]["views"])


def test_top_searches(client):
    q = f"test-recherche-{uuid.uuid4().hex[:8]}"
    for _ in range(3):
        _post(client, event_type="search", session_id="s-search", search_query=q)
    top = client.get("/analytics/top-searches?limit=100").json()
    assert {"search_query": q, "searches": 3} in top


def test_session_journey(client):
    sid = f"s-{uuid.uuid4().hex}"
    types = ["page_view", "search", "product_view", "add_to_cart"]
    for t in types:
        _post(client, event_type=t, session_id=sid, sku=SKU, search_query="rtx")
    events = client.get(f"/analytics/sessions/{sid}/events").json()
    assert [e["event_type"] for e in events] == types
    assert [e["timestamp"] for e in events] == sorted(e["timestamp"] for e in events)


def test_customer_orders_and_detail(client):
    orders = client.get("/customers/C0001/orders").json()
    assert orders
    dates = [o["order_date"] for o in orders]
    assert dates == sorted(dates, reverse=True)
    first = orders[0]
    assert isinstance(first["total"], float) and first["items"][0]["sku"]
    detail = client.get(f"/orders/{first['order_id']}")
    assert detail.status_code == 200
    assert detail.json() == first


def test_unknown_order(client):
    assert client.get("/orders/CMD-00000000-000000").status_code == 404
