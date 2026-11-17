# Choix technologiques — démarche

Ce document retrace comment nous sommes passés d'une première intuition à des choix justifiés.
La conception détaillée de chaque lot (schémas, requêtes) est dans [conception/](conception/).

## 1. Méthode

Nous ne sommes pas partis d'une technologie, mais du besoin (approche *query-driven*) :

1. Lister, pour chaque lot, les **requêtes** et les **contraintes** du sujet (volume, latence, évolution du schéma).
2. En déduire la **famille NoSQL** adaptée (document, clé-valeur, colonnes, graphe).
3. Choisir une **technologie** dans cette famille et comparer avec au moins une alternative.
4. Vérifier le **compromis CAP** : en cas de partition réseau, préfère-t-on rester cohérent ou rester disponible ?

Conséquence assumée : pas de base unique, mais une **persistance polyglotte** — une base par besoin.

## 2. Première intuition : les technologies pressenties

À la lecture du sujet, chaque lot pointe vers une famille :

| Lot | Mot-clé du sujet | Famille | Technologie pressentie |
|---|---|---|---|
| 1. Catalogue | « schémas variables », « sans migration » | Document | MongoDB |
| 2. Panier & sessions | « submilliseconde », « expiration automatique » | Clé-valeur en mémoire | Redis |
| 3. Logs & analytics | « millions d'événements par jour », « chaque clic = un log » | Colonnes | Cassandra |
| 4. Recommandations | « parcours de relations », « amis d'amis » | Graphe | Neo4j |

Cette intuition restait à confronter aux contraintes détaillées et aux alternatives.

## 3. Confrontation aux contraintes

### Lot 1 — Catalogue produits

**Contraintes clés** : schéma différent par catégorie (un processeur n'a pas les attributs d'une souris), évolution sans migration, lecture très majoritaire, sous-documents (avis, specs, compatibilités).

| Alternative | Pourquoi écartée |
|---|---|
| PostgreSQL + JSONB | Gère les attributs variables, mais on reste sur le moteur relationnel que le sujet cherche à remplacer ; la montée en charge horizontale est plus difficile. |
| Cassandra | Il faut connaître les requêtes à l'avance ; or le catalogue est filtré sur des attributs qui changent d'une catégorie à l'autre. |
| **MongoDB** ✅ | Une fiche = un document, lue en une seule requête ; nouveaux attributs sans migration ; index secondaires sur les attributs filtrés ; lectures réparties sur les réplicas. |

**Ce qu'il faudra traiter dans la conception** :
- les avis clients peuvent croître sans limite (risque de dépasser 16 Mo par document) → garder les N derniers dans la fiche (*Subset pattern*), le reste dans une collection `reviews` ;
- les attributs variables → *Attribute pattern* (`[{k, v}]`) pour pouvoir les indexer de façon uniforme ;
- les produits compatibles → références (ID) plutôt qu'embarqués, la relation complète vit dans Neo4j.

### Lot 2 — Panier et sessions

**Contraintes clés** : latence submilliseconde, expiration automatique, partage entre plusieurs serveurs web.

| Alternative | Pourquoi écartée |
|---|---|
| Sessions en mémoire du serveur + *sticky sessions* | Pas de partage : si un serveur tombe, le client perd panier et session. |
| Memcached | Rapide, mais pas de structures (hash, set), pas de persistance ni de réplication. |
| MongoDB avec index TTL | La purge TTL tourne toutes les 60 s et les lectures passent par le disque : pas submilliseconde. |
| **Redis** ✅ | En mémoire (< 1 ms), TTL natif par clé, structures adaptées (un panier = un hash), accessible par tous les serveurs web, réplication et persistance optionnelle (AOF). |

**Compromis assumé** : la réplication Redis est asynchrone → en cas de panne du primaire, les dernières écritures peuvent être perdues. On privilégie la disponibilité : perdre un article du panier est acceptable, un site qui ne répond pas ne l'est pas.

### Lot 3 — Logs et analytics

**Contraintes clés** : millions d'écritures par jour, conservation sur des mois/années, requêtes connues à l'avance (vues par produit et par jour, top produits, historique de commandes d'un client).

| Alternative | Pourquoi écartée |
|---|---|
| MongoDB (collections *time series*) | Possible, mais le passage à l'échelle en écriture repose sur le sharding, plus lourd à opérer que l'architecture sans maître de Cassandra. |
| Elasticsearch | Très bon pour l'exploration et la recherche, mais coûteux en stockage sur des années et pas conçu comme source de vérité. |
| ClickHouse / Druid (OLAP) | Excellents pour l'analytique ad hoc ; à garder en extension si le besoin d'analyses libres apparaît. |
| **Cassandra** ✅ | Écritures en append très rapides, sans maître (tous les nœuds acceptent les écritures), montée en charge linéaire, TTL pour la rétention. |

**Ce qu'il faudra traiter dans la conception** :
- une **table par requête** (la donnée est dupliquée volontairement) ;
- partitionner par jour (`(product_id, day)`) pour éviter les partitions trop grosses ;
- Cassandra ne fait pas de `GROUP BY` / `ORDER BY` global → le « top produits de la semaine » doit être **pré-agrégé** (tables de compteurs ou job Spark batch) ;
- l'historique des commandes d'un client est un historique en ajout seul, lu par client → table `orders_by_customer`.

### Lot 4 — Recommandations

**Contraintes clés** : relations multiples entre produits (compatibilité, gamme, marque, achats communs), parcours sur plusieurs niveaux.

| Alternative | Pourquoi écartée |
|---|---|
| SQL avec requêtes récursives | Chaque niveau de parcours = une jointure ; le coût explose avec la profondeur. |
| MongoDB `$graphLookup` | Fonctionne pour un seul type de relation et une faible profondeur, devient lent au-delà. |
| **Neo4j** ✅ | Les relations sont stockées comme des pointeurs : un parcours coûte en fonction des voisins visités, pas de la taille de la base. Cypher exprime directement « acheté avec », « compatible avec ». |

**Point d'architecture** : Neo4j n'est pas la source de vérité. Il est alimenté de façon asynchrone à partir du catalogue (MongoDB) et des commandes (Cassandra). Un léger retard sur les recommandations est sans conséquence.

## 4. Vue d'ensemble : où se place chaque base dans CAP

| Base | Position | Justification métier |
|---|---|---|
| MongoDB (catalogue) | **CP** par défaut (un primaire par replica set) ; lectures sur secondaires acceptées | Un prix ou une description en retard de quelques secondes est acceptable ; on gagne en débit de lecture. |
| Redis (panier) | Plutôt **AP** (réplication asynchrone) | Disponibilité et latence priment sur la perte éventuelle d'une écriture. |
| Cassandra (logs) | **AP**, cohérence réglable par requête (`ONE` pour écrire les logs, `QUORUM` si besoin) | Un clic perdu ou compté en retard ne change pas une statistique sur des millions d'événements. |
| Neo4j (recos) | **CP** (un seul leader en écriture) | Données dérivées et reconstructibles : la cohérence forte ne coûte rien côté métier. |

## 5. Ce que nous ne mettons pas en NoSQL

La **prise de commande et le paiement** exigent des transactions ACID (débit du client, décrément du stock, création de la commande : tout ou rien). Ce périmètre n'est pas dans les 4 lots ; nous le laissons dans une base relationnelle. Les commandes validées sont ensuite copiées vers Cassandra (historique) et Neo4j (« achetés ensemble »).

## 6. Décision

| Lot | Pressentie | Retenue | Ce que l'analyse a ajouté |
|---|---|---|---|
| 1. Catalogue | MongoDB | **MongoDB** | Subset pattern pour les avis, Attribute pattern pour les specs |
| 2. Panier & sessions | Redis | **Redis** | Hash par panier, TTL glissant, AOF pour limiter les pertes |
| 3. Logs & analytics | Cassandra | **Cassandra** | Partition par jour, agrégats pré-calculés, historique des commandes inclus |
| 4. Recommandations | Neo4j | **Neo4j** | Alimentation asynchrone depuis MongoDB et Cassandra |

Les quatre intuitions sont confirmées ; l'analyse a surtout fait apparaître les **points de conception** à traiter dans chaque lot.
