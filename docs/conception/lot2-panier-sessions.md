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

**Modèle de clés (contrat).**

| Clé | Type | TTL | Contenu |
|---|---|---|---|
| `session:{sid}` | Hash | 1 800 s glissant | `customer_id` ("" si anonyme), `cart_id`, `created_at`, `last_seen` |
| `cart:{cart_id}` | Hash | 7 j anonyme / 30 j client, glissant | champ = SKU, valeur = quantité |
| `product:{sku}` | String (JSON) | 300 s | cache-aside fiche produit |

`cart_id` = `anon:{uuid4 hex}` ou `customer:{customer_id}`. Le panier d'un client connecté est donc indexé par client : il le retrouve sur un autre appareil.

**Hash plutôt que JSON.** `HINCRBY` modifie une ligne en O(1) sans lire-modifier-réécrire tout le panier, donc sans course entre deux onglets. Les petits Hash sont encodés en *listpack*, très compacts. Le produit en cache reste une String JSON, parce qu'il est toujours lu et écrit d'un bloc.

**TTL glissant.** Chaque accès repose `EXPIRE` : la session meurt après 30 min d'inactivité, le panier après 7 ou 30 jours. Aucun job de purge n'est nécessaire.

## Requêtes types

```redis
HSET session:9f2c customer_id "" cart_id anon:4be1 created_at 2026-11-18T10:00Z last_seen 2026-11-18T10:00Z
EXPIRE session:9f2c 1800
MULTI                                   # ajout au panier + rafraîchissement des TTL
HINCRBY cart:anon:4be1 CPU-AMD-R7-9800X3D 1
EXPIRE cart:anon:4be1 604800
EXPIRE session:9f2c 1800
EXEC
HGETALL cart:anon:4be1                  # lecture du panier (enrichi ensuite par MongoDB : nom, prix courant)
# Login : fusion ligne à ligne puis bascule de la session
HINCRBY cart:customer:C0001 CPU-AMD-R7-9800X3D 1      # pour chaque champ du panier anonyme
DEL cart:anon:4be1
HSET session:9f2c customer_id C0001 cart_id customer:C0001
EXPIRE cart:customer:C0001 2592000
```

Script complet et exécutable : [db/redis/queries.redis](../../db/redis/queries.redis).

## Justification des compromis

_À compléter (CAP, patterns, Query-Driven)._
