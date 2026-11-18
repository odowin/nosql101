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
| Bonus : front | [bonus/front/README.md](bonus/front/README.md) (Next.js, port 3000) |

## Lancer les bases et les schémas

Prérequis : Docker et Docker Compose, environ 3 Go de RAM libres, ports 8000, 7474 et 7687 disponibles. MongoDB, Redis et Cassandra ne publient aucun port sur l'hôte : on les interroge avec `docker compose exec`.

### Linux / macOS / Git Bash

```bash
docker compose up -d --build   # 1er démarrage ≈ 2 min (Cassandra) ; schémas appliqués par les jobs d'init, API seedée
```

### Windows PowerShell — séquence complète testée

À coller d'un coup : elle démarre la stack, attend que l'API réponde, puis affiche l'état des conteneurs et les messages du seed.

```powershell
cd C:\Users\spard\Projects\AILEDELAISSEE\nosql101   # à adapter selon l'emplacement du dépôt
Remove-Item db\mongodb\seed.js -ErrorAction SilentlyContinue
docker stop mon-mongo cass-de-sandra 2>$null | Out-Null
docker compose up -d --build
$deadline = (Get-Date).AddMinutes(10)
$ok = $false
while (-not $ok -and (Get-Date) -lt $deadline) {
  Start-Sleep 5
  try {
    $h = Invoke-RestMethod "http://localhost:8000/health"
    $ok = ($h.mongodb -eq 'ok' -and $h.redis -eq 'ok' -and $h.cassandra -eq 'ok' -and $h.neo4j -eq 'ok')
  } catch { }
}
if ($ok) { '=== STACK PRETE ===' } else { '=== TIMEOUT : docker compose logs api ===' }
if ($h) { $h | ConvertTo-Json -Compress }
docker compose ps
docker compose logs api | Select-String '\[seed\]'
```

> `docker stop mon-mongo cass-de-sandra` est facultatif : ces deux conteneurs jetables occupent ~1 Go et le port 27017. Sans cela, Compass sur `localhost:27017` afficherait leur ancienne base, et non celle du projet.

Attendu :

- `=== STACK PRETE ===` et `{"mongodb":"ok","redis":"ok","cassandra":"ok","neo4j":"ok"}` ;
- `mongo`, `redis`, `cassandra`, `neo4j` et `api` en `Up (healthy)` ; `cassandra-init` et `neo4j-init` en `Exited (0)` ;
- dans les logs de l'API :

```
[seed] mongodb ok
[seed] redis ok
[seed] cassandra ok
[seed] neo4j ok
[seed] mongodb : 44 produits, 35 avis
[seed] cassandra : 123 commandes, 616 compteurs de vues
[seed] neo4j : 44 produits, 123 commandes, 306 paires BOUGHT_WITH
```

- API (bonus) : <http://localhost:8000/docs> — voir [api/README.md](api/README.md)
- Neo4j Browser : <http://localhost:7474> (`neo4j` / `ldlc-password`)

## Vérifier les données

Les commandes ci-dessous passent par `docker compose exec` : elles fonctionnent dans n'importe quel shell et évitent l'écueil des ports non publiés.

### MongoDB

```bash
docker compose exec -T mongo mongosh ldlc --quiet --eval "printjson({produits:db.products.countDocuments(),categories:db.categories.countDocuments(),marques:db.brands.countDocuments(),avis:db.reviews.countDocuments()})"
docker compose exec -T mongo mongosh ldlc --quiet --eval "printjson(db.products.getIndexes().map(i=>i.name))"
docker compose exec -T mongo mongosh ldlc --quiet --eval "printjson(db.products.findOne({_id:'CPU-AMD-R7-9800X3D'},{name:1,price:1,stock:1,rating:1}))"
```

Attendu : `44 / 18 / 21 / 35` ; six index dont `category._id_1_specs.k_1_specs.v_1` ; fiche `AMD Ryzen 7 9800X3D`, `Decimal128('489.95')`, `stock.status: 'in_stock'`, `rating {avg: 4.67, count: 3, sum: 14}`.

### Redis

```bash
docker compose exec -T redis redis-cli DBSIZE
```

Attendu : `0` au départ. Redis n'est pas seedé : il se remplit à l'usage (cache `product:{sku}`, sessions `session:{sid}`, paniers `cart:{...}`).

### Cassandra

```bash
docker compose exec -T cassandra cqlsh -k ldlc -e "SELECT count(*) FROM orders_by_id;"
docker compose exec -T cassandra cqlsh -k ldlc -e "SELECT count(*) FROM product_views_by_day;"
docker compose exec -T cassandra cqlsh -k ldlc -e "SELECT customer_id, order_date, order_id, status, total FROM orders_by_customer WHERE customer_id='C0001';"
```

Attendu : `123` commandes, `616` compteurs de vues (44 produits × 14 jours), 3 commandes pour `C0001`. L'avertissement `Aggregation query used without partition key` est normal pour les deux `count(*)`.

### Neo4j

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p ldlc-password "MATCH (n) RETURN labels(n)[0] AS label, count(*) AS noeuds ORDER BY noeuds DESC;"
```

Attendu : `Customer 60`, `Product 44`, `Range 39`, `Brand 21`, `Category 18`, `Standard 10`. La requête 7 de `db/neo4j/queries.cypher` donne le chemin `CPU-AMD-R7-9800X3D → socket:AM5 → MB-ASUS-B650M-PRIME → memory:DDR5 → RAM-CORSAIR-VENGEANCE-32-6000`, soit 4 sauts.

## Vérifier l'API (bonus)

Sous PowerShell, le préfixe `http://` est obligatoire (`Invoke-RestMethod localhost:8000/health` échoue) et `Invoke-WebRequest` a besoin de `-UseBasicParsing` (sinon « Windows PowerShell n'est pas en mode interactif »).

```powershell
$API = "http://localhost:8000"
Invoke-RestMethod "$API/health" | ConvertTo-Json -Compress
Invoke-RestMethod "$API/products?category=cpu&spec=socket:AM5" | Select-Object total
docker compose exec -T redis redis-cli DEL product:CPU-AMD-R7-9800X3D | Out-Null
(Invoke-WebRequest "$API/products/CPU-AMD-R7-9800X3D" -UseBasicParsing).Headers['X-Cache']
(Invoke-WebRequest "$API/products/CPU-AMD-R7-9800X3D" -UseBasicParsing).Headers['X-Cache']
Invoke-RestMethod "$API/analytics/top-products?period=week" | Select-Object -ExpandProperty items | Select-Object -First 5 rank, sku, views | Format-Table -AutoSize
Invoke-RestMethod "$API/customers/C0001/orders" | Select-Object -First 3 order_id, status, total | Format-Table -AutoSize
Invoke-RestMethod "$API/recommendations/CPU-AMD-R7-9800X3D/compatible" | Select-Object -First 3 sku, category | Format-Table -AutoSize
docker compose exec -T api pytest -q
```

Attendu : 4 bases `ok` ; `total = 3` ; `MISS` puis `HIT` ; 5 rangs (n°1 `GPU-GIGABYTE-RTX5060-WINDFORCE`, 344 vues) ; 3 commandes pour `C0001` ; des cartes mères AM5 ; `34 passed`.

L'appel `/analytics/top-products` remplit la table Cassandra `top_products_by_period` : sans lui, Q2 de `queries.cql` renvoie 0 ligne sur une stack fraîche.

## Front

Un front Next.js consomme l'API : `docker compose up -d --build` puis http://localhost:3000 (catalogue, panier, commandes, analytics). Détails : [bonus/front/README.md](bonus/front/README.md).

## Exécuter les requêtes types

Depuis la racine du dépôt, bases démarrées (bash) :

```bash
docker compose cp db/mongodb/queries.js mongo:/tmp/q.js && docker compose exec -T mongo mongosh ldlc --quiet -f /tmp/q.js
grep -v '^#' db/redis/queries.redis | grep -v '^$' | docker compose exec -T redis redis-cli
docker compose exec -T cassandra cqlsh -k ldlc < db/cassandra/queries.cql
docker compose exec -T neo4j cypher-shell -u neo4j -p ldlc-password < db/neo4j/queries.cypher
```

Windows PowerShell — même séquence :

```powershell
docker compose cp db/mongodb/queries.js mongo:/tmp/q.js | Out-Null
docker compose exec -T mongo mongosh ldlc --quiet -f /tmp/q.js
Get-Content db\redis\queries.redis | Where-Object { $_ -notmatch '^\s*#' -and $_.Trim() -ne '' } | docker compose exec -T redis redis-cli
docker compose cp db/cassandra/queries.cql cassandra:/tmp/q.cql | Out-Null
docker compose exec -T cassandra cqlsh -k ldlc -f /tmp/q.cql
docker compose cp db/neo4j/queries.cypher neo4j:/tmp/q.cypher | Out-Null
docker compose exec -T neo4j cypher-shell -u neo4j -p ldlc-password -f /tmp/q.cypher
```

Points d'attention :

- MongoDB §6 : `avg 4.25 / count 4 / sum 17` ; §8 : `FETCH` + `IXSCAN`, index `category._id_1_specs.k_1_specs.v_1`, `3 / 3` ; le validateur rejette un `stock.status` inconnu (`refusé (121)`).
- Cassandra Q2 : le littéral du fichier (`week:2026-W47`) est celui du jour du seed et change chaque lundi. Le recalculer puis relire :

```powershell
$week = (docker compose exec -T api python -c "from datetime import datetime,timezone;d=datetime.now(timezone.utc).date();y,w,_=d.isocalendar();print(f'week:{y}-W{w:02d}')").Trim()
docker compose exec -T cassandra cqlsh -k ldlc -e "SELECT rank, sku, views FROM top_products_by_period WHERE period='$week' LIMIT 10;"
```

- Cassandra ligne 40 : l'`order_id` codé en dur est celui du seed du 18/11/2026. Après un re-seed, en récupérer un réel :

```powershell
docker compose exec -T cassandra cqlsh -k ldlc -e "SELECT order_id FROM orders_by_id LIMIT 3;"
```

- Neo4j : le SKU `TEST-CPU-DEMO` visible dans `product_views_by_day` est volontaire (compteur de test laissé en place).

Avec l'API démarrée, les lectures portent sur le jeu de démonstration ; les exemples d'écriture de chaque fichier créent leurs données puis les nettoient.

## Réinitialiser

```bash
docker compose exec -T api python -m app.seed   # idempotent : ignore les bases déjà peuplées
docker compose down -v                          # efface les volumes
docker compose up -d --build                    # schémas + seed rejoués
```

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| `dependency failed to start` | `docker compose logs cassandra-init` ou `neo4j-init` : le schéma n'a pas été appliqué |
| `/health` en 503 | `docker compose logs api` : la base en cause est nommée dans la réponse |
| `Le préfixe URI n'est pas reconnu` | PowerShell 5.1 : ajouter `http://` devant `localhost:8000` |
| `n'est pas en mode interactif` | `Invoke-WebRequest` : ajouter `-UseBasicParsing` |
| Compass ne voit aucun produit | le port 27017 appartient à `mon-mongo` ; utiliser `docker compose exec -T mongo mongosh ldlc` |

## Structure du dépôt

```
.
├── README.md
├── CONTRIBUTING.md         # workflow git de l'équipe
├── docker-compose.yml      # mongo, redis, cassandra, neo4j, api (+ jobs d'init des schémas)
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
