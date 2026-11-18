# Refonte NoSQL LDLC

> Une base par besoin : MongoDB (catalogue), Redis (paniers), Cassandra (logs et historique), Neo4j (recommandations) pour remplacer le monolithe relationnel de LDLC (27 000 références, 600+ marques, millions de visites, 25 000 colis/jour).

## Membres

- Owen Dias
- Romain Bories
- Lucas Magalhaes

## L'architecture en bref

Persistance polyglotte : une technologie par besoin. Schéma Mermaid, flux numérotés et légende : [architecture/README.md](architecture/README.md) (vue simplifiée draw.io incluse).

| Lot | Besoin | Techno | Pourquoi | CAP |
|---|---|---|---|---|
| 1 | Catalogue produits | **MongoDB 8** (document) | Fiches hétérogènes (specs par catégorie), facettes, lecture massive | CP |
| 2 | Paniers et sessions | **Redis 7.4** (clé-valeur) | Latence sub-ms, TTL natifs, panier en Hash (`HINCRBY`) | AP |
| 3 | Logs, analytics, historique commandes | **Cassandra 5.0** (colonnes larges) | Écritures massives, partitions par clé de requête, multi-datacenter | AP |
| 4 | Recommandations | **Neo4j 5.26** (graphe) | Compatibilité et « achetés ensemble » = parcours de relations | CP |

**CAP** : MongoDB (replica set) et Neo4j (cluster Raft) sont CP ; Redis Cluster est AP (réplication asynchrone, perte possible des dernières écritures au basculement, acceptable pour un panier) ; Cassandra est AP avec cohérence réglable par requête (`LOCAL_ONE` / `LOCAL_QUORUM`). Détail et compromis : [docs/conception/00-contexte-synthese.md](docs/conception/00-contexte-synthese.md).

Hors périmètre : la prise de commande et le paiement restent dans une base relationnelle (transactions ACID).

## Livrables

| Livrable | Fichier |
|---|---|
| Sujet du projet | [docs/sujet.md](docs/sujet.md) |
| Historique des versions | [CHANGELOG.md](CHANGELOG.md) |
| Schéma d'architecture | [architecture/README.md](architecture/README.md) (Mermaid) |
| Contexte, hypothèses, synthèse des compromis | [docs/conception/00-contexte-synthese.md](docs/conception/00-contexte-synthese.md) |
| Conception Lot 1 — Catalogue produits | [docs/conception/lot1-catalogue-produits.md](docs/conception/lot1-catalogue-produits.md) |
| Conception Lot 2 — Panier et sessions | [docs/conception/lot2-panier-sessions.md](docs/conception/lot2-panier-sessions.md) |
| Conception Lot 3 — Logs et analytics | [docs/conception/lot3-logs-analytics.md](docs/conception/lot3-logs-analytics.md) |
| Conception Lot 4 — Recommandations | [docs/conception/lot4-recommandations.md](docs/conception/lot4-recommandations.md) |
| Démarche des choix technologiques | [docs/choix-technologiques.md](docs/choix-technologiques.md) |
| Schémas de données | [MongoDB](db/mongodb/init.js) · [Cassandra](db/cassandra/schema.cql) · [Neo4j](db/neo4j/schema.cypher) · Redis : modèle de clés dans [le Lot 2](docs/conception/lot2-panier-sessions.md) |
| Requêtes types | [MongoDB](db/mongodb/queries.js) · [Redis](db/redis/queries.redis) · [Cassandra](db/cassandra/queries.cql) · [Neo4j](db/neo4j/queries.cypher) |
| Environnement local des 4 bases | [docker-compose.yml](docker-compose.yml) |
| Bonus : prototype d'API | [api/README.md](api/README.md) (FastAPI, Swagger, tests) |

## Lancer les bases et les schémas

Prérequis : Docker et Docker Compose, environ 3 Go de RAM libres.

```bash
docker compose up -d --build   # 1er démarrage ≈ 2 min (Cassandra) ; schémas appliqués par les jobs d'init, API seedée
```

- API (bonus) : <http://localhost:8000/docs> — voir [api/README.md](api/README.md)
- Neo4j Browser : <http://localhost:7474> (`neo4j` / `ldlc-password`)
- Réinitialiser (efface les volumes) : `docker compose down -v`

## Exécuter les requêtes types

Depuis la racine du dépôt, bases démarrées :

```bash
docker compose cp db/mongodb/queries.js mongo:/tmp/q.js && docker compose exec -T mongo mongosh ldlc --quiet -f /tmp/q.js
grep -v '^#' db/redis/queries.redis | grep -v '^$' | docker compose exec -T redis redis-cli
docker compose exec -T cassandra cqlsh -k ldlc < db/cassandra/queries.cql
docker compose exec -T neo4j cypher-shell -u neo4j -p ldlc-password < db/neo4j/queries.cypher
```

Avec l'API démarrée, les lectures portent sur le jeu de démonstration ; les exemples d'écriture de chaque fichier créent leurs données puis les nettoient.

## Structure du dépôt

```
.
├── README.md
├── CONTRIBUTING.md         # workflow git de l'équipe
├── docker-compose.yml      # mongo, redis, cassandra, neo4j (+ jobs d'init des schémas)
├── docs/
│   ├── sujet.md            # énoncé du projet
│   ├── choix-technologiques.md  # démarche de choix par lot
│   └── conception/         # contexte et synthèse, un fichier par lot
├── architecture/           # schéma d'architecture globale (Mermaid + draw.io)
├── db/                     # schémas et requêtes types : mongodb/, redis/, cassandra/, neo4j/
└── api/                    # prototype d'API FastAPI (bonus)
```

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) : branches par lot, PR vers `develop`, conventions de commit.
