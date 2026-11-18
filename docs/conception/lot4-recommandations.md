# Lot 4 — Recommandations produits

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

**Neo4j 5.26 en cluster** — modèle graphe, CP (Raft) pour les écritures. Place dans l'architecture : voir le [schéma d'architecture](../../architecture/README.md) (flux ④ commande, ⑤ recommandations, ⑥ synchronisation catalogue) et la [synthèse](00-contexte-synthese.md).

| Lot | Techno | Modèle | CAP (sous partition) | Justification métier |
|---|---|---|---|---|
| 4 Recommandations | Neo4j 5.26 cluster | Graphe | CP (Raft) pour les écritures | parcours multi-sauts (achats, compatibilité) |

**Pourquoi le graphe.** Les cas d'usage sont des **parcours** : client → produit → client → produit, produit → standard → produit. Neo4j stocke les relations comme des pointeurs (*index-free adjacency*) : un saut coûte O(degré local), quelle que soit la taille totale de la base. En SQL, chaque saut est une jointure (requêtes récursives `WITH RECURSIVE` qui explosent à 3 sauts). En MongoDB, `$graphLookup` ne suit qu'un type de lien, sans filtrage ni scoring riche en cours de parcours. Cypher exprime aussi directement des motifs (« même standard, rôles opposés »).

## Schéma de données

_À compléter._

## Requêtes types

_À compléter._

## Justification des compromis

_À compléter (CAP, patterns, Query-Driven)._
