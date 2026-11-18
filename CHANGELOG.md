# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [1.0.0] — 2026-11-18

Première version rendue : architecture de données NoSQL de la refonte LDLC (persistance polyglotte, une base par lot).

### Versions des technologies

| Lot | Base | Version | Image Docker |
|---|---|---|---|
| 1. Catalogue produits | MongoDB | 8 | `mongo:8` |
| 2. Panier & sessions | Redis | 7.4 | `redis:7.4-alpine` |
| 3. Logs & analytics | Cassandra | 5.0 | `cassandra:5.0` |
| 4. Recommandations | Neo4j | 5.26 (Community) | `neo4j:5.26-community` |

### Ajouté

- **Lot 1 — Catalogue** (#11) : conception MongoDB ([docs/conception/lot1-catalogue-produits.md](docs/conception/lot1-catalogue-produits.md)), script d'initialisation et requêtes types (`db/mongodb/`).
- **Lot 2 — Panier & sessions** (#5) : conception Redis (modèle de clés, TTL glissant), requêtes types (`db/redis/queries.redis`).
- **Lot 3 — Logs & analytics** (#6) : conception Cassandra (tables par requête, partition keys, clustering), schéma et requêtes CQL (`db/cassandra/`).
- **Lot 4 — Recommandations** (#7) : conception Neo4j (modèle de graphe, compatibilité par Standard), contraintes et requêtes Cypher (`db/neo4j/`).
- **Architecture** (#8) : schéma Mermaid et flux numérotés ([architecture/README.md](architecture/README.md)), contexte et synthèse des compromis CAP ([docs/conception/00-contexte-synthese.md](docs/conception/00-contexte-synthese.md)), environnement local des 4 bases ([docker-compose.yml](docker-compose.yml)).

### Modifié

- [docs/choix-technologiques.md](docs/choix-technologiques.md) aligné sur la conception (cohérence `LOCAL_ONE` / `LOCAL_QUORUM`, alimentation de Neo4j via Kafka, partitionnement Cassandra).
- [README.md](README.md) : architecture, livrables par lot, lancement des bases et des requêtes types.

### Non inclus

- Prototype d'API (bonus) : `api/` vide.

[1.0.0]: https://github.com/odowin/nosql101/releases/tag/v1.0.0
