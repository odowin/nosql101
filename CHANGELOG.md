# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [1.3.0] — 2026-11-18

Front aligné sur le design de ldlc.com et sessions utilisateur (#21).

### Ajouté

- **Design ldlc.com** dans le front ([bonus/front/README.md](bonus/front/README.md)), sans logo ni visuel de la marque :
  - Coquille : Montserrat et Source Serif 4, couleurs mesurées en `oklch()` (contraste AA), pages internes claires à blocs blancs, accueil sombre ; en-tête compact fixe au défilement ; méga-menu « Tous nos produits » et tiroir mobile ; recherche avec suggestions ; pied de page bleu nuit et réassurance.
  - Pages : catégorie (`/categories/[id]`), liste à filtres (marques, double curseur de prix, en stock, en promo, caractéristiques) avec tri et pagination, fiche à onglets (description, fiche technique, avis notés sur 10), panneau « ajouté au panier » avec vente croisée, panier à étapes, connexion (`/connexion`), compte, promos (`/promos`).
  - Mobile : barres collantes (Filtrer, Acheter, Passer commande), feuille de filtres.
- **Sessions utilisateur** (Lot 2, Redis) : page `/compte` avec connexion par identifiant client (fusion du panier), TTL glissant de la session, déconnexion (`DELETE /sessions/{sid}`, le panier client est conservé) ; identifiant dans l'en-tête.
- **API** : `GET /products` accepte `sort` (`price_asc`, `price_desc`, `name`, `rating`, `discount`, sur le prix effectif), `brand` répétable et `in_stock` ; tests pytest associés.

## [1.2.0] — 2026-11-18

Front Next.js du prototype et promotions sur le catalogue (#18, #19).

### Ajouté

- **Front Next.js** ([bonus/front/README.md](bonus/front/README.md)) : service `front` dans [docker-compose.yml](docker-compose.yml) sur `http://localhost:3000`, qui consomme uniquement l'API.
  - Lot 1 : catalogue à facettes (filtres dans l'URL), fiche produit, avis.
  - Lot 2 : session en cookie httpOnly, panier optimiste avec retour arrière, connexion client et fusion du panier, commande.
  - Lot 3 : vues du jour, top produits et recherches, vues quotidiennes, historique des commandes.
  - Lot 4 : recommandations compatibles, achetés ensemble, ont aussi acheté, similaires, personnalisées.
  - Stack : Next.js 16.4, React 19.3, TypeScript, Tailwind 4, shadcn ; types générés depuis l'OpenAPI de l'API.
- **Promotions** (#19), réintroduites depuis la première version du Lot 1 :
  - [Lot 1](docs/conception/lot1-catalogue-produits.md) : sous-document `promo` embarqué (pourcentage ou prix fixe, période `[starts_at, ends_at)`), validateur `oneOf`, index partiel `promo.ends_at`, requête « promos en cours » ([db/mongodb/](db/mongodb/)).
  - API : prix effectif calculé à la lecture (exact malgré le cache Redis) et recalculé au paiement, filtre `GET /products?on_sale=true`, promos dans le jeu de démonstration.
  - Front : prix barré, badge de remise, filtre « En promo », section « Promos en cours ».

### Corrigé

- Healthcheck du conteneur `front` en IPv4 (`127.0.0.1`).

## [1.1.0] — 2026-11-18

Ajout du prototype d'API (bonus) qui implémente les 4 lots (#16).

### Ajouté

- **Prototype d'API FastAPI** ([api/README.md](api/README.md)) : service `api` dans [docker-compose.yml](docker-compose.yml), Swagger sur `http://localhost:8000/docs`.
  - Lot 1 : catalogue MongoDB (facettes, fiche avec cache-aside Redis, création libre de produit, avis subset + computed).
  - Lot 2 : sessions et panier Redis (TTL glissant, fusion au login).
  - Lot 3 : événements, compteurs, top produits, top recherches, historique des commandes (Cassandra).
  - Lot 4 : recommandations Neo4j ; la validation du panier écrit dans Cassandra et Neo4j.
- Jeu de démonstration ([api/data/catalog.json](api/data/catalog.json)) chargé par un seed idempotent ; 34 tests pytest exécutés contre la stack.

### Corrigé

- [db/mongodb/init.js](db/mongodb/init.js) et [Lot 1](docs/conception/lot1-catalogue-produits.md) : le validateur accepte les attributs multi-valués (tableaux dans `specs.v`, ex. `sockets`, `supported_form_factors`).

## [1.0.1] — 2026-11-18

Relecture de cohérence entre les documents après la restructuration par lot (#13).

### Corrigé

- [docs/choix-technologiques.md](docs/choix-technologiques.md) : les produits compatibles ne sont pas de simples références ; la fiche porte les clés `compat` et un extrait embarqué `compatible` (≤ 5), le graphe Neo4j fait foi pour la relation complète (aligné sur le Lot 1).
- [Lot 4](docs/conception/lot4-recommandations.md) et [synthèse](docs/conception/00-contexte-synthese.md) : si Neo4j est indisponible, le repli se fait sur le top des produits **consultés** (`top_products_by_period`), pas sur les ventes.
- [Lot 3](docs/conception/lot3-logs-analytics.md) : l'exemple d'ingestion précise la pré-agrégation des compteurs par le consommateur (`views + n`).

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

- Prototype d'API (bonus) : `api/` vide (ajouté en 1.1.0).

[1.3.0]: https://github.com/odowin/nosql101/releases/tag/v1.3.0
[1.2.0]: https://github.com/odowin/nosql101/releases/tag/v1.2.0
[1.1.0]: https://github.com/odowin/nosql101/releases/tag/v1.1.0
[1.0.1]: https://github.com/odowin/nosql101/releases/tag/v1.0.1
[1.0.0]: https://github.com/odowin/nosql101/releases/tag/v1.0.0
