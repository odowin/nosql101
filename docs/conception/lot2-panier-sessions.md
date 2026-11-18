# Lot 2 — Panier et sessions utilisateurs

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

**Pourquoi Redis.** Données en RAM (latence < 1 ms), TTL par clé natif, structures riches (Hash = panier ligne à ligne), réplication et cluster.

| Techno | Modèle | CAP (sous partition) | Justification métier |
|---|---|---|---|
| Redis 7.4 Cluster 3+3 | Clé-valeur en mémoire | AP (réplication asynchrone) | latence < 1 ms, TTL natif, partage entre serveurs web |

Flux ② de l'[architecture globale](../../architecture/README.md) : API → Redis `session:{sid}`, `cart:{cart_id}` (TTL glissant), serveurs web stateless. Redis porte aussi le cache-aside des fiches produit (flux ①, voir [Lot 1](lot1-catalogue-produits.md)). Contexte et hypothèses : [00-contexte-synthese.md](00-contexte-synthese.md).

### Alternatives écartées

| Alternative | Rejet |
|---|---|
| Memcached | pas de structures (panier sérialisé en entier à chaque ligne), pas de persistance ni de réplication |
| Sessions en base (SQL / MongoDB) | aller-retour disque, purge des expirés à programmer, charge sur la base métier |
| Sessions locales + sticky sessions | perte de session à chaque redéploiement ou panne de serveur, répartition de charge déséquilibrée |

## Schéma de données

_À compléter._

## Requêtes types

_À compléter._

## Justification des compromis

_À compléter (CAP, patterns, Query-Driven)._
