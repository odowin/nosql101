-- Schéma Cassandra (une table par requête)
CREATE KEYSPACE IF NOT EXISTS ldlc
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
  -- prod : {'class': 'NetworkTopologyStrategy', 'dc_paris': 3, 'dc_lyon': 3}

CREATE TYPE IF NOT EXISTS ldlc.order_line (sku text, name text, quantity int, unit_price decimal);

-- Archive brute des événements (jobs batch, rejeu). shard = crc32(session_id) % 8
CREATE TABLE IF NOT EXISTS ldlc.events_by_hour (
  day date, hour tinyint, shard tinyint, event_id timeuuid,
  event_type text, session_id text, customer_id text, sku text, url text, search_query text,
  PRIMARY KEY ((day, hour, shard), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS', 'compaction_window_size': 7}
  AND default_time_to_live = 34214400;   -- 396 jours ≈ 13 mois

-- Parcours d'une session
CREATE TABLE IF NOT EXISTS ldlc.events_by_session (
  session_id text, event_id timeuuid,
  event_type text, customer_id text, sku text, url text, search_query text,
  PRIMARY KEY ((session_id), event_id)
) WITH CLUSTERING ORDER BY (event_id ASC)
  AND default_time_to_live = 7776000;    -- 90 jours

-- Q1 : vues d'un produit un jour donné (+ série sur N jours)
CREATE TABLE IF NOT EXISTS ldlc.product_views_by_day (
  sku text, day date, views counter,
  PRIMARY KEY ((sku), day)
) WITH CLUSTERING ORDER BY (day DESC);

-- Q2 (source) : vues de tous les produits d'un jour, éclatées en 8 shards. shard = crc32(sku) % 8
CREATE TABLE IF NOT EXISTS ldlc.daily_views_by_shard (
  day date, shard tinyint, sku text, views counter,
  PRIMARY KEY ((day, shard), sku)
);

-- Q2 (résultat) : classement pré-calculé. period = 'day:2026-11-18' | 'week:2026-W47'
CREATE TABLE IF NOT EXISTS ldlc.top_products_by_period (
  period text, rank int, sku text, views bigint, computed_at timestamp,
  PRIMARY KEY ((period), rank)
) WITH CLUSTERING ORDER BY (rank ASC);

-- Recherches : top requêtes du jour. shard = crc32(search_query) % 8
CREATE TABLE IF NOT EXISTS ldlc.searches_by_day (
  day date, shard tinyint, search_query text, searches counter,
  PRIMARY KEY ((day, shard), search_query)
);

-- Q3 : historique des commandes d'un client
CREATE TABLE IF NOT EXISTS ldlc.orders_by_customer (
  customer_id text, order_date timestamp, order_id text,
  status text, total decimal, items list<frozen<order_line>>,
  PRIMARY KEY ((customer_id), order_date, order_id)
) WITH CLUSTERING ORDER BY (order_date DESC, order_id ASC);

-- Détail d'une commande (suivi, SAV)
CREATE TABLE IF NOT EXISTS ldlc.orders_by_id (
  order_id text PRIMARY KEY,
  customer_id text, order_date timestamp, status text, total decimal, items list<frozen<order_line>>
);
