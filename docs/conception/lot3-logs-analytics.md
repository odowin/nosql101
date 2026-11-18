# Lot 3 — Logs et analytics

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

Place dans l'architecture : [architecture](../../architecture/README.md) (flux ③ événements et ④ commandes) ; contexte et synthèse des compromis dans [00-contexte-synthese.md](00-contexte-synthese.md).

| Lot | Techno | Modèle | CAP (sous partition) | Justification métier |
|---|---|---|---|---|
| 3 Logs/analytics | Cassandra 5.0, 2 DC × 3, RF=3 | Colonnes larges | AP, cohérence réglable | écritures massives, rétention longue, scalabilité linéaire |

**Pourquoi Cassandra.**
- Écritures en LSM-tree (commit log séquentiel + memtable) : chaque clic est une écriture bon marché.
- Architecture sans maître et scalabilité linéaire : on ajoute des nœuds.
- TTL par ligne + **TimeWindowCompactionStrategy** : les fenêtres expirées sont supprimées en bloc. Fenêtre de 7 jours, soit ~57 SSTables sur 13 mois (cible : quelques dizaines ; une fenêtre d'un jour en donnerait ~400).
- Réplication multi-DC native.

Volumétrie brute : 5 M × ~400 o × 396 j ≈ 0,8 To, soit ~2,4 To par DC avec RF=3.

| Alternative | Rejet |
|---|---|
| MongoDB time series | adapté, mais les écritures passent par un seul primaire par shard et le multi-DC actif-actif manque |
| Elasticsearch | excellent pour la recherche dans les logs, mais coûteux en stockage indexé sur 13 mois, et la durabilité n'est pas sa vocation |
| Entrepôt (BigQuery, ClickHouse…) | idéal pour l'**ad hoc**, mais ne sert pas des lectures unitaires temps réel (historique client) ; il est prévu en aval (data lake, voir [synthèse](00-contexte-synthese.md)) |

## Schéma de données

Cassandra impose le **query-driven** : une table par requête, des données dupliquées, et aucune requête hors clé.

| Requête | Table | Clé de partition → accès |
|---|---|---|
| Q1 vues d'un produit un jour / sur N jours | `product_views_by_day` | `sku`, tranche sur `day` |
| Q2 top produits du jour / de la semaine | `top_products_by_period` (alimentée depuis `daily_views_by_shard`) | `period`, lecture des N premiers `rank` |
| Q3 historique des commandes d'un client | `orders_by_customer` | `customer_id`, plus récentes d'abord |
| Détail d'une commande (SAV) | `orders_by_id` | `order_id` |
| Top recherches du jour | `searches_by_day` | `(day, shard)` × 8 shards, fusion des 8 partitions et tri en mémoire |
| Parcours d'une session | `events_by_session` | `session_id`, ordre chronologique |
| Archive brute (batch, rejeu) | `events_by_hour` | `(day, hour, shard)` |

**Annotation des clés (notation Chebotko : K = partition, C↑/C↓ = clustering, ++ = compteur).**

| Table | K | C | Colonnes | TTL |
|---|---|---|---|---|
| `events_by_hour` | day, hour, shard | event_id ↓ | event_type, session_id, customer_id, sku, url, search_query | 396 j |
| `events_by_session` | session_id | event_id ↑ | event_type, customer_id, sku, url, search_query | 90 j |
| `product_views_by_day` | sku | day ↓ | views ++ | — |
| `daily_views_by_shard` | day, shard | sku ↑ | views ++ | — |
| `searches_by_day` | day, shard | search_query ↑ | searches ++ | — |
| `top_products_by_period` | period | rank ↑ | sku, views, computed_at | — |
| `orders_by_customer` | customer_id | order_date ↓, order_id ↑ | status, total, items | — |
| `orders_by_id` | order_id | — | customer_id, order_date, status, total, items | — |

**Taille des partitions (cible < 100 k lignes, < 100 Mo).**
- `events_by_hour` : 5 M / 24 h / 8 shards ≈ **26 k lignes** (~10 Mo) en moyenne. En pic ×10 sur une heure, on monte à ~260 k : en production, on passe à **32 shards** (≈ 65 k en pic). `shard = crc32(session_id) % N` répartit la charge sur N nœuds au lieu d'une partition chaude par heure (**write sharding**).
- `daily_views_by_shard` : 27 000 SKU / 8 ≈ 3,4 k lignes ; le shard `crc32(sku) % 8` évite que tous les compteurs d'un jour pèsent sur une seule partition. `searches_by_day` suit le même principe avec `shard = crc32(search_query) % 8` ; la longue traîne des requêtes est bornée par la journée.
- `product_views_by_day` : 365 lignes par an et par produit. `top_products_by_period` : ≤ 100 lignes.
- `orders_by_customer` : quelques dizaines de commandes par particulier, partition bornée. Pour un client B2B (milliers de commandes), on ajouterait un bucket `year` à la clé de partition.


```sql
CREATE TABLE ldlc.events_by_hour (
  day date, hour tinyint, shard tinyint, event_id timeuuid,
  event_type text, session_id text, customer_id text, sku text, url text, search_query text,
  PRIMARY KEY ((day, hour, shard), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_unit': 'DAYS', 'compaction_window_size': 7}
  AND default_time_to_live = 34214400;                          -- 396 j ≈ 13 mois

CREATE TABLE ldlc.product_views_by_day (sku text, day date, views counter,
  PRIMARY KEY ((sku), day)) WITH CLUSTERING ORDER BY (day DESC);

CREATE TYPE ldlc.order_line (sku text, name text, quantity int, unit_price decimal);
CREATE TABLE ldlc.orders_by_customer (
  customer_id text, order_date timestamp, order_id text,
  status text, total decimal, items list<frozen<order_line>>,
  PRIMARY KEY ((customer_id), order_date, order_id)
) WITH CLUSTERING ORDER BY (order_date DESC, order_id ASC);
```

Schéma complet : [`db/cassandra/schema.cql`](../../db/cassandra/schema.cql). Keyspace de production : `NetworkTopologyStrategy {'dc_paris': 3, 'dc_lyon': 3}`.

## Requêtes types

_À compléter._

## Justification des compromis

_À compléter (CAP, patterns, Query-Driven)._
