# Contexte, hypothèses et synthèse des compromis

Document de conception, partie transverse. Les conceptions détaillées par lot :
[Lot 1 — Catalogue (MongoDB)](lot1-catalogue-produits.md) ·
[Lot 2 — Panier et sessions (Redis)](lot2-panier-sessions.md) ·
[Lot 3 — Logs et analytics (Cassandra)](lot3-logs-analytics.md) ·
[Lot 4 — Recommandations (Neo4j)](lot4-recommandations.md).

## 1. Contexte et hypothèses

LDLC remplace une base relationnelle monolithique qui sature. Les ordres de grandeur ci-dessous sont des **hypothèses de dimensionnement** (extrapolées du sujet), pas des chiffres officiels.

| Grandeur | Hypothèse | Conséquence |
|---|---|---|
| Références produits | 27 000, ~10 Ko/fiche | catalogue < 1 Go : tient en RAM (working set) |
| Marques | 600 | référentiel petit, quasi statique |
| Visites | ~10 M/mois (~330 k/jour) | lectures catalogue ≫ écritures |
| Événements de navigation | ~5 M/jour (~60/s moyen), pics ×10 aux sorties de composants | charge d'écriture continue et en rafales |
| Commandes | 25 000/jour (~0,3/s) | faible débit, mais historique sur 10 ans (~90 M commandes) |
| Sessions / paniers actifs | ~50 k sessions simultanées en pic, ~1 M paniers conservés | données chaudes, volatiles |

**Principes directeurs.**
- **Persistance polyglotte** : chaque lot a un profil d'accès différent, on choisit le modèle (document, clé-valeur, colonnes, graphe) qui le sert nativement.
- **Query-driven** : les schémas partent des requêtes métier (surtout Cassandra et Redis), pas des entités.
- **CAP / PACELC** : pour chaque base, on choisit explicitement ce qu'on sacrifie en cas de partition (P → A ou C) et en fonctionnement normal (E → latence ou cohérence), en fonction du **coût métier** d'une erreur.

## 2. Architecture globale

Schéma d'architecture globale (Mermaid, flux numérotés et légende) : [architecture/README.md](../../architecture/README.md).

| Flux | Description |
|---|---|
| ① Fiche produit | API → Redis `product:{sku}` (cache-aside, 300 s) → sur MISS MongoDB `products` |
| ② Panier / session | API → Redis `session:{sid}`, `cart:{cart_id}` (TTL glissant), serveurs web stateless |
| ③ Événements | navigateur → API (collecte) → Kafka `navigation-events` → consommateur → Cassandra (archive + compteurs) |
| ④ Commande | checkout → **service commandes** (SGBD relationnel ACID existant, hors périmètre : paiement, stock, facture) → outbox → Kafka `order-events` → Cassandra (historique) + Neo4j (`PURCHASED`, `BOUGHT_WITH`) |
| ⑤ Recommandations | API → Neo4j (lecture sur read replicas) |
| ⑥ Synchronisation catalogue | Change Streams MongoDB → Kafka `catalog-changes` → Neo4j (projection) + `DEL product:{sku}` dans Redis |

| Lot | Techno | Modèle | CAP (sous partition) | Justification métier |
|---|---|---|---|---|
| 1 Catalogue | MongoDB 8, replica set 3 nœuds | Document | CP (élection, écritures suspendues quelques s) | fiches hétérogènes, évolution sans migration, lectures massives |
| 2 Panier/sessions | Redis 7.4 Cluster 3+3 | Clé-valeur en mémoire | AP (réplication asynchrone) | latence < 1 ms, TTL natif, partage entre serveurs web |
| 3 Logs/analytics | Cassandra 5.0, 2 DC × 3, RF=3 | Colonnes larges | AP, cohérence réglable | écritures massives, rétention longue, scalabilité linéaire |
| 4 Recommandations | Neo4j 5.26 cluster | Graphe | CP (Raft) pour les écritures | parcours multi-sauts (achats, compatibilité) |

**Pourquoi pas une seule base ?** Les quatre besoins sont antagonistes : le catalogue veut un schéma souple et des filtres ad hoc, le panier une latence mémoire avec expiration, les logs un débit d'écriture append-only sur des téraoctets, les recommandations des jointures récursives. Une base unique (le monolithe actuel) optimise mal au moins trois d'entre eux. MongoDB seul, par exemple, ferait des sessions sur disque avec un index TTL purgé toutes les 60 s, et des recommandations en `$graphLookup` coûteux.

**Coût assumé du polyglotte.**
- *Exploitation* : 4 moteurs à superviser, sauvegarder et maîtriser. On limite le périmètre à des technologies standard et on garde le cœur transactionnel existant.
- *Cohérence inter-bases* : elle n'est qu'**à terme**. Le service commandes applique le **pattern outbox** (commande et message écrits dans la même transaction ACID, relais vers Kafka) : pas de double écriture perdue. Kafka garantit *at-least-once*, donc tous les consommateurs sont **idempotents** : clés naturelles (`order_id`, `event_id` timeuuid, SKU), `INSERT` Cassandra = upsert, `MERGE` Neo4j.
- *CQRS* : le modèle d'écriture des commandes reste relationnel. Cassandra n'en porte qu'un **modèle de lecture** (historique client, détail SAV), reconstructible par rejeu de `order-events`.

## 3. Synthèse des compromis

| Techno | CAP | PACELC | Réglage retenu | Risque accepté |
|---|---|---|---|---|
| MongoDB | CP | PC/EC (écritures), EL (navigation) | `w: majority`, `secondaryPreferred` sauf prix au checkout (`primary`) | écritures suspendues ~10 s pendant une élection ; fiche périmée ≤ 300 s via le cache |
| Redis Cluster | AP | PA/EL | réplication asynchrone, AOF `everysec`, `volatile-ttl` | perte des dernières lignes de panier au basculement ; fusion au login non atomique |
| Cassandra | AP (réglable) | PA/EL (événements), PC/EC local (commandes) | `LOCAL_ONE` / `LOCAL_QUORUM`, RF=3 × 2 DC, BATCH loggé | compteurs approximatifs ; agrégats en retard de 5 min |
| Neo4j | CP (Raft) | PC/EC (primaires), EL (replicas) | lectures sur replicas, bookmarks si besoin | recommandations en retard de quelques secondes ; repli sur le top ventes |
| Kafka | CP | — | `acks=all`, `min.insync.replicas=2`, consommateurs idempotents | doublons (absorbés par l'idempotence), délai de propagation |

**Risques et limites.**
- Complexité d'exploitation de 4 moteurs, qui demande des compétences, de la supervision et des sauvegardes par moteur.
- Cohérence inter-bases à terme seulement : un produit créé apparaît dans les recommandations après le délai de propagation.
- Pas de recherche plein texte de qualité (pertinence, fautes de frappe, synonymes).
- Les analyses ad hoc sont hors de portée de Cassandra.

**Évolutions.**
- **OpenSearch** alimenté par le même flux ⑥ pour la recherche et l'autocomplétion.
- **Data lake** (Kafka → Parquet sur stockage objet → Spark/Trino) pour l'analytique ad hoc et le recalcul exact des compteurs.
- **Neo4j GDS** (Node Similarity, Louvain pour les communautés d'acheteurs, PageRank) pour des recommandations plus fines, calculées hors ligne.
