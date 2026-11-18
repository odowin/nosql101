-- Requêtes types du Lot 3 (logs, analytics, historique des commandes) — Cassandra 5.0, keyspace ldlc.
-- Exécution : docker compose -p ldlc-nosql exec -T cassandra cqlsh -k ldlc < db/cassandra/queries.cql
-- Principe : une table par requête, chaque SELECT cible UNE partition (pas d'ALLOW FILTERING, pas d'index secondaire).
-- Les dates utilisent currentDate() pour rester valables quel que soit le jour d'exécution.

-- ========== Q1 : vues d'un produit ==========
-- Partition = sku, clustering = day DESC : lecture d'un jour = lecture d'une ligne d'une partition.
SELECT views FROM product_views_by_day WHERE sku = 'CPU-AMD-R7-9800X3D' AND day = currentDate();

-- Série sur 7 jours : balayage de plage (slice) contigu dans la même partition, déjà trié du plus récent au plus ancien.
SELECT day, views FROM product_views_by_day WHERE sku = 'CPU-AMD-R7-9800X3D' AND day >= currentDate() - 6d;

-- ========== Q2 : produits les plus vus ==========
-- Lecture du classement PRÉ-CALCULÉ (une partition par période, rank = clustering). Cette table est
-- remplie par un job périodique (lecture des 8 shards de daily_views_by_shard, fusion et tri en
-- mémoire, upsert des rangs), jamais par une requête Cassandra : pas d'ORDER BY sur un compteur.
SELECT rank, sku, views FROM top_products_by_period WHERE period = 'week:2026-W47' LIMIT 10;

-- Lecture brute d'UNE partition source (jour, shard) : le shard = crc32(sku) % 8 répartit les produits sur
-- 8 partitions, ce qui borne la taille d'une partition et évite le point chaud d'un « jour » unique.
-- Le job lit les 8 shards (0 à 7) ; ici le shard 5, qui contient CPU-AMD-R7-9800X3D.
SELECT sku, views FROM daily_views_by_shard WHERE day = currentDate() AND shard = 5;

-- ========== Top recherches du jour ==========
-- Même schéma de sharding : 8 partitions lues (une requête par shard), fusion et tri côté application.
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 0;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 1;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 2;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 3;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 4;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 5;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 6;
SELECT search_query, searches FROM searches_by_day WHERE day = currentDate() AND shard = 7;

-- ========== Q3 : historique des commandes d'un client ==========
-- Partition = customer_id, clustering (order_date DESC, order_id) : les plus récentes d'abord, LIMIT = pagination.
SELECT order_date, order_id, status, total FROM orders_by_customer WHERE customer_id = 'C0001' LIMIT 20;

-- Détail d'une commande par identifiant (suivi, SAV) : table dédiée, lecture par clé primaire (dénormalisation CQRS).
SELECT order_id, customer_id, order_date, status, total, items FROM orders_by_id WHERE order_id = 'CMD-20260820-6c0311';

-- ========== Parcours d'une session ==========
-- (Les lignes de test sont insérées plus bas ; la session TEST-SESSION est supprimée à la fin.)

-- ========== Écritures : ingestion d'un événement (test) ==========
-- event_id = now() : timeuuid généré à l'écriture, trie chronologiquement dans la partition.
-- events_by_hour : partition (day, hour, shard) ; jour fictif 2000-01-01 pour ne pas toucher aux vraies données.
INSERT INTO events_by_hour (day, hour, shard, event_id, event_type, session_id, sku)
  VALUES ('2000-01-01', 0, 6, now(), 'product_view', 'TEST-SESSION', 'TEST-CPU-DEMO');
-- events_by_session : partition = session, ordre chronologique ASC (rejouer le parcours).
INSERT INTO events_by_session (session_id, event_id, event_type, sku)
  VALUES ('TEST-SESSION', now(), 'product_view', 'TEST-CPU-DEMO');
INSERT INTO events_by_session (session_id, event_id, event_type, sku, search_query)
  VALUES ('TEST-SESSION', now(), 'search', NULL, 'rtx 5070');
INSERT INTO events_by_session (session_id, event_id, event_type, sku)
  VALUES ('TEST-SESSION', now(), 'add_to_cart', 'TEST-CPU-DEMO');
-- Compteurs : incréments atomiques sans lecture préalable (pas de read-before-write).
UPDATE product_views_by_day SET views = views + 1 WHERE sku = 'TEST-CPU-DEMO' AND day = currentDate();
UPDATE daily_views_by_shard SET views = views + 1 WHERE day = currentDate() AND shard = 6 AND sku = 'TEST-CPU-DEMO';

SELECT sku, day, views FROM product_views_by_day WHERE sku = 'TEST-CPU-DEMO';
SELECT day, hour, shard, event_type, sku FROM events_by_hour WHERE day = '2000-01-01' AND hour = 0 AND shard = 6;

-- Parcours de la session de test : une partition, événements dans l'ordre d'arrivée.
SELECT toTimestamp(event_id) AS quand, event_type, sku, search_query FROM events_by_session WHERE session_id = 'TEST-SESSION';

-- ========== Écriture : enregistrement d'une commande (test) ==========
-- BATCH loggé : garantit que les deux tables dénormalisées finissent toutes deux écrites (atomicité
-- éventuelle, au prix d'un coût de coordination : à réserver à quelques lignes, ici 2 tables).
BEGIN BATCH
  INSERT INTO orders_by_customer (customer_id, order_date, order_id, status, total, items)
    VALUES ('CTEST', '2026-11-18 10:00:00+0000', 'CMD-TEST-000001', 'paid', 129.90,
            [{sku: 'TEST-CPU-DEMO', name: 'Produit de test', quantity: 1, unit_price: 129.90}]);
  INSERT INTO orders_by_id (order_id, customer_id, order_date, status, total, items)
    VALUES ('CMD-TEST-000001', 'CTEST', '2026-11-18 10:00:00+0000', 'paid', 129.90,
            [{sku: 'TEST-CPU-DEMO', name: 'Produit de test', quantity: 1, unit_price: 129.90}]);
APPLY BATCH;

SELECT customer_id, order_id, status, total, items FROM orders_by_customer WHERE customer_id = 'CTEST';
SELECT order_id, customer_id, status, total FROM orders_by_id WHERE order_id = 'CMD-TEST-000001';

-- ========== Nettoyage ==========
-- Suppression par partition (une tombstone), pas de DELETE massif. Les compteurs du SKU TEST-CPU-DEMO
-- (product_views_by_day, daily_views_by_shard) restent : un compteur supprimé puis réincrémenté est
-- fragile dans Cassandra, et ces lignes n'affectent aucune donnée réelle.
DELETE FROM events_by_hour WHERE day = '2000-01-01' AND hour = 0 AND shard = 6;
DELETE FROM events_by_session WHERE session_id = 'TEST-SESSION';
DELETE FROM orders_by_customer WHERE customer_id = 'CTEST';
DELETE FROM orders_by_id WHERE order_id = 'CMD-TEST-000001';
SELECT count(*) FROM events_by_session WHERE session_id = 'TEST-SESSION';
