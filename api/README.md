# Prototype d'API (bonus)

API **FastAPI** (Python 3.11) qui implémente les 4 lots de la [conception](../docs/conception/00-contexte-synthese.md) sur les bases du `docker-compose.yml` : un nœud par base, écritures directes (sans Kafka).

## Lancer

Depuis la racine du dépôt :

```bash
docker compose up -d --build        # 1er démarrage ≈ 2 min (Cassandra)
curl localhost:8000/health          # 200 quand les 4 bases répondent
```

- Swagger : <http://localhost:8000/docs>
- Tests : `docker compose exec -T api pytest -q`
- Réinitialiser : `docker compose down -v`

Au démarrage, un seed idempotent charge [data/catalog.json](data/catalog.json) (44 produits, avis, paniers types) dans MongoDB, génère des commandes et 14 jours de vues dans Cassandra, et projette le catalogue et les achats dans Neo4j. Les **mêmes** commandes alimentent Cassandra et Neo4j.

## Scénario de démo

```bash
API=localhost:8000

# 1. Lot 1 : CPU socket AM5 (MongoDB)
curl -s "$API/products?category=cpu&spec=socket:AM5"

# 2. Fiche produit deux fois : X-Cache: MISS puis HIT (Redis cache-aside)
curl -si $API/products/CPU-AMD-R7-9800X3D | grep -i x-cache
curl -si $API/products/CPU-AMD-R7-9800X3D | grep -i x-cache

# 3. Lot 2 : session + panier anonyme
SID=$(curl -s -X POST $API/sessions | python3 -c 'import sys,json;print(json.load(sys.stdin)["session_id"])')
curl -s -X POST $API/cart/items -H "X-Session-Id: $SID" -H 'Content-Type: application/json' \
  -d '{"sku":"CPU-AMD-R7-9800X3D","quantity":1}'

# 4. Connexion du client C0001 (fusion du panier) puis commande
curl -s -X POST $API/sessions/$SID/login -H 'Content-Type: application/json' -d '{"customer_id":"C0001"}'
curl -s -X POST $API/cart/checkout -H "X-Session-Id: $SID"

# 5. Lot 3 : historique des commandes (Cassandra)
curl -s $API/customers/C0001/orders

# 6. Événement de vue, puis compteur du jour et classement
curl -s -X POST $API/events -H 'Content-Type: application/json' \
  -d "{\"event_type\":\"product_view\",\"session_id\":\"$SID\",\"sku\":\"CPU-AMD-R7-9800X3D\"}"
curl -s $API/analytics/products/CPU-AMD-R7-9800X3D/views
curl -s "$API/analytics/top-products?period=week"

# 7. Lot 4 : recommandations (Neo4j)
curl -s $API/recommendations/CPU-AMD-R7-9800X3D/compatible
curl -s $API/recommendations/CPU-AMD-R7-9800X3D/also-bought
```

Attendu : l'étape 2 affiche `X-Cache: MISS` puis `X-Cache: HIT` ; l'étape 5 contient la commande `CMD-yyyymmdd-xxxxxx` créée à l'étape 4 ; l'étape 6 renvoie `views` ≥ 1 ; `compatible` liste des cartes mères AM5.

## Routes de l'API

| Lot | Routes |
|---|---|
| Santé | `GET /health` |
| 1 — Catalogue | `GET /categories` · `GET /products` (filtres `category`, `brand`, `q`, `min_price`, `max_price`, `spec=k:v`, `limit`, `skip`) · `GET /products/{sku}` · `POST /products` · `GET` et `POST /products/{sku}/reviews` |
| 2 — Sessions et panier | `POST /sessions` · `GET` et `DELETE /sessions/{sid}` · `POST /sessions/{sid}/login` · `GET /cart` · `POST /cart/items` · `PUT` et `DELETE /cart/items/{sku}` · `POST /cart/checkout` (en-tête `X-Session-Id`) |
| 3 — Logs et analytics | `POST /events` · `GET /analytics/sessions/{sid}/events` · `GET /analytics/products/{sku}/views` · `GET /analytics/products/{sku}/views/daily` · `GET /analytics/top-products` · `GET /analytics/top-searches` · `GET /customers/{id}/orders` · `GET /orders/{order_id}` |
| 4 — Recommandations | `GET /recommendations/customers/{id}` · `GET /recommendations/{sku}/also-bought` · `/bought-together` · `/compatible` · `/similar` |

## Organisation du code

| Fichier | Rôle |
|---|---|
| `app/main.py` | application FastAPI, `/health` |
| `app/db.py` | connexions aux 4 bases, sérialisation JSON (Decimal128, ObjectId, dates) |
| `app/catalog.py` | Lot 1 — MongoDB + cache-aside Redis |
| `app/cart.py` | Lot 2 — sessions et panier Redis, validation du panier |
| `app/analytics.py` | Lot 3 — événements, compteurs, top produits, historique des commandes (Cassandra) |
| `app/reco.py` | Lot 4 — recommandations (Neo4j) |
| `app/seed.py` | jeu de démonstration |
| `tests/` | tests pytest par lot (exécutés contre la stack) |

## Limites

- Un seul nœud par base : réplication, sharding et multi-datacenter sont décrits dans la conception, pas déployés.
- Pas de Kafka : l'API écrit directement dans Cassandra et Neo4j (en production, outbox + Kafka).
- Top-N recalculé à la lecture au lieu d'un job planifié ; pas d'authentification (le client est déclaré au `login`).
