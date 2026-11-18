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

**Hash plutôt que JSON.** `HINCRBY` modifie une ligne en O(1) sans lire-modifier-réécrire tout le panier, donc sans course entre deux onglets. Les petits Hash sont encodés en *listpack*, très compacts. Le produit en cache reste une String JSON, parce qu'il est toujours lu et écrit d'un bloc. Le prix effectif d'une promo n'est pas mis en cache : il est calculé à la lecture depuis `promo` (dates comprises), donc la promo reste exacte malgré le TTL de 300 s.

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

**Dimensionnement.** ~1 M paniers × 0,5 Ko + 50 k sessions × 0,3 Ko + 27 k fiches × 10 Ko ≈ **0,8 Go**. Trois maîtres suffisent largement ; le cluster sert la disponibilité plus que la capacité. L'environnement local (Docker Compose) est limité à `maxmemory 256mb`.

**Persistance et éviction.** `appendonly yes` + `appendfsync everysec` : au pire 1 s d'écritures perdues au redémarrage. `maxmemory-policy volatile-ttl` : toutes les clés ont un TTL, et sous pression mémoire Redis évince d'abord celles dont le TTL restant est le plus court. L'ordre suit la valeur métier : le cache produit (≤ 300 s, reconstructible depuis MongoDB) part en premier, puis les sessions (≤ 30 min), et les paniers (7 à 30 j) en dernier. On ne perd donc un panier qu'en ultime recours, sans jamais refuser d'écriture.

**Redis Cluster.** 16 384 hash slots répartis sur 3 maîtres, chacun avec un réplica. `cart:anon:…` et `cart:customer:…` tombent dans des slots différents : la fusion au login **n'est pas atomique** (pas de `MULTI` multi-slots, et un hash tag commun est impossible puisque les deux identifiants sont indépendants). Pire cas, une interruption au milieu de la fusion double une quantité, ce que le client voit et corrige avant de payer. Un panier n'est pas une commande, le risque est donc accepté.

**CAP / PACELC : AP, PA/EL.** La réplication maître→réplica est asynchrone : lors d'un basculement, les dernières écritures acquittées peuvent être perdues (une ligne de panier, une session à recréer). Justification métier : un panier se reconstruit en un clic, alors qu'une latence ou une indisponibilité au moment d'ajouter un article coûte une vente. Le paiement, lui, ne lit jamais Redis comme source de vérité : le service commandes revalide prix et stock. Les serveurs web sont **stateless** (identifiant de session porté par un cookie) et s'ajoutent derrière le load balancer sans affinité.

| Techno | CAP | PACELC | Réglage retenu | Risque accepté |
|---|---|---|---|---|
| Redis Cluster | AP | PA/EL | réplication asynchrone, AOF `everysec`, `volatile-ttl` | perte des dernières lignes de panier au basculement ; fusion au login non atomique |

Comparaison avec les trois autres bases : [00-contexte-synthese.md](00-contexte-synthese.md).
