import uuid
from datetime import datetime, timezone

from app.db import neo4j_driver
from app.reco import record_purchase

CPU = "CPU-AMD-R7-9800X3D"


def _q(cypher, **params):
    records, _, _ = neo4j_driver().execute_query(cypher, parameters_=params, database_="neo4j")
    return [r.data() for r in records]


def test_compatible_cpu(client):
    items = client.get(f"/recommendations/{CPU}/compatible?category=motherboard").json()
    assert items and all(i["category"] == "motherboard" for i in items)
    assert all(i["via"] == ["socket:AM5"] for i in items)  # aucune carte LGA1851 / LGA1700


def test_compatible_case_gives_motherboards(client):
    case = _q("MATCH (p:Product {category: 'case'})-[:SUPPORTS]->(:Standard {kind: 'form_factor'}) RETURN p.sku AS sku LIMIT 1")[0]["sku"]
    items = client.get(f"/recommendations/{case}/compatible?category=motherboard").json()
    assert items and all(any(v.startswith("form_factor:") for v in i["via"]) for i in items)


def test_also_bought(client):
    items = client.get(f"/recommendations/{CPU}/also-bought").json()
    assert items and CPU not in {i["sku"] for i in items}
    buyers = [i["buyers"] for i in items]
    assert buyers == sorted(buyers, reverse=True)


def test_bought_together_sorted(client):
    items = client.get(f"/recommendations/{CPU}/bought-together?limit=10").json()
    assert items
    counts = [i["count"] for i in items]
    assert counts == sorted(counts, reverse=True)


def test_similar_same_category(client):
    items = client.get(f"/recommendations/{CPU}/similar").json()
    assert items and {i["category"] for i in items} == {"cpu"}
    assert CPU not in {i["sku"] for i in items}


def test_customer_reco_excludes_purchased(client):
    items = client.get("/recommendations/customers/C0001?limit=20").json()
    bought = {r["sku"] for r in _q("MATCH (:Customer {id: 'C0001'})-[:PURCHASED]->(p) RETURN p.sku AS sku")}
    assert items and not bought & {i["sku"] for i in items}


def test_unknown_404(client):
    for path in ("also-bought", "bought-together", "compatible", "similar"):
        assert client.get(f"/recommendations/NOPE-XXX/{path}").status_code == 404
    assert client.get("/recommendations/customers/NOPE").status_code == 404


def test_record_purchase_idempotent():
    row = _q("MATCH (a:Product)-[:BOUGHT_WITH]->(b:Product) RETURN a.sku AS a, b.sku AS b LIMIT 1")[0]
    a, b = row["a"], row["b"]
    cid = f"TEST-CUST-{uuid.uuid4().hex[:8]}"
    order = {"customer_id": cid, "order_id": f"CMD-TEST-{uuid.uuid4().hex[:6]}",
             "order_date": datetime.now(timezone.utc),
             "items": [{"sku": b, "quantity": 1}, {"sku": a, "quantity": 2}]}

    def count():
        return _q("MATCH (:Product {sku: $a})-[r:BOUGHT_WITH]->(:Product {sku: $b}) RETURN r.count AS c", a=a, b=b)[0]["c"]

    before = count()
    try:
        record_purchase(order)
        record_purchase(order)
        assert count() == before + 1
        assert _q("MATCH (:Customer {id: $c})-[r:PURCHASED]->() RETURN count(r) AS n", c=cid)[0]["n"] == 2
    finally:
        _q("MATCH (c:Customer {id: $c}) DETACH DELETE c", c=cid)
        _q("MATCH (:Product {sku: $a})-[r:BOUGHT_WITH]->(:Product {sku: $b}) SET r.count = r.count - 1", a=a, b=b)
