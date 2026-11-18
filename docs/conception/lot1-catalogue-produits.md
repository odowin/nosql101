# Lot 1 — Catalogue produits

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

**MongoDB 8, replica set de 3 nœuds (modèle document, CP sous partition).** Une fiche est un agrégat lu d'un bloc, avec des attributs propres à chaque catégorie (socket d'un CPU, édition d'une licence). Le catalogue (27 000 références, < 1 Go) tient en RAM et se lit bien plus qu'il ne s'écrit. Hypothèses de dimensionnement et place du lot dans l'ensemble : [contexte et synthèse](00-contexte-synthese.md), [architecture](../../architecture/README.md).

| Alternative | Rejet |
|---|---|
| SQL en EAV | un filtre à N critères = N auto-jointures, typage perdu, contraintes inexploitables |
| SQL + JSONB | crédible, mais la montée en charge reste verticale (le problème actuel). MongoDB offre réplication et sharding natifs, un validateur de schéma partiel et l'agrégation |
| Cassandra | une table par requête : incompatible avec des filtres à facettes combinables arbitrairement |
| Clé-valeur | accès par clé seulement, aucun filtre ni index secondaire (on l'utilise comme **cache**) |

## Schéma de données

Collections : `products`, `categories`, `brands`, `reviews`. Script : [init.js](../../db/mongodb/init.js).

**Polymorphisme : deux documents de la même collection `products`.**

```js
{ _id: "CPU-AMD-R7-9800X3D", name: "AMD Ryzen 7 9800X3D (4.7 GHz / 5.2 GHz)", slug: "amd-ryzen-7-9800x3d",
  category: { _id: "cpu", name: "Processeurs", path: "informatique/composants/cpu" },
  brand: { _id: "amd", name: "AMD" }, range: "Ryzen 7", price: NumberDecimal("489.95"),
  stock: { status: "in_stock", qty: 42 },
  specs: [ { k: "socket", label: "Socket", v: "AM5" }, { k: "cores", label: "Cœurs", v: 8 },
           { k: "tdp", label: "TDP", v: 120, u: "W" } ],
  compat: { uses: ["socket:AM5"], supports: [] },
  compatible: [ { sku: "MB-MSI-X870-TOMAHAWK", name: "MSI MAG X870 TOMAHAWK WIFI" } ],  // ≤ 5, pour l'affichage
  rating: { avg: 4.8, count: 12, sum: 58 }, top_reviews: [ /* 3 avis les plus récents */ ],
  schema_version: 1, created_at: ISODate("2026-10-02T08:00:00Z"), updated_at: ISODate("2026-11-17T09:12:00Z") }

{ _id: "OS-MICROSOFT-WIN11-PRO", name: "Microsoft Windows 11 Professionnel 64 bits", slug: "windows-11-pro",
  category: { _id: "os", name: "Systèmes d'exploitation", path: "informatique/logiciels/os" },
  brand: { _id: "microsoft", name: "Microsoft" }, price: NumberDecimal("259.95"),
  stock: { status: "in_stock", qty: 999 },
  specs: [ { k: "edition", label: "Édition", v: "Professionnel" }, { k: "license", label: "Licence", v: "ESD" } ],
  delivery: { mode: "download", activation: "clé numérique" },   // champ propre aux logiciels
  compat: { uses: [], supports: [] }, rating: { avg: 0, count: 0, sum: 0 }, top_reviews: [], schema_version: 1 }

// categories : arbre (Array of Ancestors) + facettes typées qui pilotent le panneau de filtres et le typage de specs.v
{ _id: "cpu", name: "Processeurs", parent: "composants", ancestors: ["informatique", "composants"],
  facets: [ { k: "socket", label: "Socket", type: "string" }, { k: "cores", label: "Cœurs", type: "number" },
            { k: "tdp", label: "TDP", type: "number", u: "W" } ] }
```

Un produit reconditionné garde sa catégorie d'origine et porte un attribut `condition` (`"refurbished"`) : le menu « Reconditionnés » est une vue filtrée, pas une catégorie.

**Embedded ou référence.** On embarque ce qui est borné, lu avec le parent et modifié avec lui ; on référence ce qui est non borné ou partagé.

| Sous-élément | Choix | Raison |
|---|---|---|
| `specs` | **embedded** (tableau `k/v`) | toujours lu avec la fiche, borné (10 à 50), relation 1-à-quelques |
| `brand` | **extended reference** `{_id, name}` | 600 marques partagées, nom quasi immuable ; le détail reste dans `brands` |
| `category` | **extended reference** `{_id, name, path}` | fil d'Ariane sans jointure ; l'arbre vit dans `categories` |
| Avis | **référence** (collection `reviews`) + subset `top_reviews` + computed `rating` | 1-à-beaucoup **non borné** : l'embarquer gonflerait le document (limite 16 Mo, working set) alors que la fiche n'affiche que 3 avis |
| Produits compatibles | clés `compat.uses/supports` (vérité côté catalogue) + **subset embedded** `compatible: [{sku, name}]` (≤ 5, extended reference) ; la liste complète vient du graphe ([Lot 4](lot4-recommandations.md)) | une liste complète embarquée est N×M : un nouveau boîtier ATX imposerait de réécrire des centaines de fiches (amplification d'écriture, listes périmées). Le subset de 5 suffit à la fiche, sans requête au graphe ; il est recalculé depuis les clés `compat` et peut être en retard, alors que le graphe fait foi pour la compatibilité complète |
| `stock` | **embedded**, instantané `{status, qty}` | affichage seulement ; la vérité reste dans le SI transactionnel, mise à jour par événement |

**Patterns appliqués.**

| Pattern | Où | Problème résolu |
|---|---|---|
| Polymorphic | `products` unique pour toutes les catégories | un seul index, une seule requête de liste, champs propres tolérés |
| Attribute | `specs: [{k, label, v, u}]` + index `{category._id, specs.k, specs.v}` | indexer des attributs inconnus à l'avance avec **un** index composé au lieu d'un index par attribut |
| Extended Reference | `brand`, `category` | éviter un `$lookup` sur la requête la plus fréquente |
| Subset | `top_reviews` (3 plus récents), `compatible` (≤ 5) | fiche légère ; avis complets dans `reviews`, compatibilité complète dans le graphe |
| Computed | `rating {avg, count, sum}` | moyenne maintenue à l'écriture (rare) plutôt que calculée à chaque lecture (fréquente) |
| Schema Versioning | `schema_version` | les formats coexistent, migration paresseuse à la réécriture |
| Array of Ancestors | `categories.ancestors` | sous-arbre en une requête indexée (`{ancestors: "composants"}`) |

**Validation et index.** Le schéma est ouvert mais pas anarchique. Le validateur impose le minimum vital, et `moderate` n'applique pas les règles aux documents anciens déjà invalides, ce qui laisse les versions de schéma coexister. Les prix sont en `Decimal128` : un `double` dérive sur les montants (`599.00` devient `598.9999…` après quelques calculs).

```js
db.createCollection("products", { validationLevel: "moderate", validator: { $jsonSchema: {
  bsonType: "object", required: ["name", "category", "brand", "price"],
  properties: { name: { bsonType: "string" }, slug: { bsonType: "string" }, price: { bsonType: "decimal" },
    schema_version: { bsonType: "int" },
    stock: { bsonType: "object", properties: { status: { enum: ["in_stock", "low_stock", "out_of_stock", "preorder"] } } },
    specs: { bsonType: "array", items: { bsonType: "object", required: ["k", "v"], properties: {
      k: { bsonType: "string" }, v: { bsonType: ["string", "int", "double", "bool", "decimal", "array"] }, u: { bsonType: "string" } } } } } } } })
```

Convention : une valeur numérique n'est jamais une chaîne avec unité (`v: 120, u: "W"`, pas `v: "120 W"`), sinon `$gte`/`$lte` sur `specs.v` ne fonctionnent plus. Un attribut multi-valué est un tableau (`{ k: "sockets", v: ["AM5", "LGA1851"] }`) : `$elemMatch: { k: "sockets", v: "AM5" }` le trouve, car MongoDB compare la valeur à chaque élément du tableau.

Index `products` : `{category._id:1, price:1}` (liste triée par prix), `{category._id:1, specs.k:1, specs.v:1}` (facettes), `{brand._id:1}`, `{slug:1}` unique, texte `{name:"text"}`. Index `reviews` : `{product_id:1, created_at:-1}`. Index `categories` : `{ancestors:1}`.

## Requêtes types

Version exécutable et commentée : [queries.js](../../db/mongodb/queries.js) (mongosh).

```js
// Filtre à facettes : CPU AM5, ≥ 8 cœurs, ≤ 600 €
db.products.find({ "category._id": "cpu", price: { $lte: NumberDecimal("600") },
  specs: { $all: [ { $elemMatch: { k: "socket", v: "AM5" } },
                   { $elemMatch: { k: "cores", v: { $gte: 8 } } } ] } }).sort({ price: 1 }).limit(20)

// Fiche produit (1 lecture par _id) + avis paginés
db.products.findOne({ _id: "CPU-AMD-R7-9800X3D" })
db.reviews.find({ product_id: "CPU-AMD-R7-9800X3D" }).sort({ created_at: -1 }).skip(0).limit(10)

// Compteurs de facettes d'une catégorie (panneau de filtres)
db.products.aggregate([ { $match: { "category._id": "cpu" } }, { $unwind: "$specs" },
  { $group: { _id: { k: "$specs.k", v: "$specs.v" }, n: { $sum: 1 } } }, { $sort: { "_id.k": 1, n: -1 } } ])

// Ajout d'un avis : insertion, puis UNE mise à jour par pipeline du produit (subset + computed)
db.reviews.insertOne(r)   // r = { _id, product_id, customer_id, author, rating: 5, title, comment, created_at }
db.products.updateOne({ _id: r.product_id }, [
  { $set: { "rating.count": { $add: [{ $ifNull: ["$rating.count", 0] }, 1] },
            "rating.sum": { $add: [{ $ifNull: ["$rating.sum", 0] }, r.rating] },
            top_reviews: { $slice: [{ $sortArray: { sortBy: { created_at: -1 }, input: { $concatArrays: [
              { $ifNull: ["$top_reviews", []] },
              [{ $literal: { _id: r._id, author: r.author, rating: r.rating, title: r.title, created_at: r.created_at } }] ] } } }, 3] } } },
  { $set: { "rating.avg": { $divide: ["$rating.sum", "$rating.count"] } } } ])   // + DEL product:{sku}

// Évolution sans migration : nouvel attribut et nouvelle catégorie
db.products.insertOne({ _id: "GPU-NVIDIA-RTX5090", /* … */ specs: [ { k: "dlss", label: "DLSS", v: "4" } ] })
db.categories.insertOne({ _id: "vr", name: "Casques VR", parent: "peripheriques",
  ancestors: ["informatique", "peripheriques"], facets: [ { k: "refresh_rate", label: "Fréquence", type: "number", u: "Hz" } ] })
```

Chaque critère de facette exige son propre `$elemMatch` : sans lui, le `socket` d'un élément et le `AM5` d'un autre suffiraient à faire correspondre le document. Seul le premier `$elemMatch` borne l'index `{category._id, specs.k, specs.v}` ; les suivants sont filtrés au FETCH, donc on place le critère le plus sélectif en premier.

Le pipeline recalcule `count`, `sum`, `avg` et `top_reviews` (3 plus récents, sous-ensemble des champs de l'avis) en une seule écriture atomique, sans lecture préalable. Restent deux écritures non transactionnelles, l'insertion dans `reviews` puis la mise à jour de `products` : une coupure entre les deux laisse un avis présent mais non compté, que l'on recalcule depuis `reviews`. Si ce décalage devenait inacceptable, une transaction multi-documents est possible sur le replica set, au prix de la latence.

## Justification des compromis

- **Cohérence (CP, PC/EC en écriture).** Replica set de 3 nœuds, écritures `w: "majority"` : un avis ou un prix acquitté survit à la perte du primaire. Risque accepté : écritures suspendues ~10 s pendant une élection.
- **Latence en lecture (EL).** Navigation en `readPreference: secondaryPreferred` : on répartit la charge et on accepte quelques ms de retard de réplication. Le **prix au checkout** se lit sur le `primary` : le client paie le prix réel.
- **Cache.** Cache-aside Redis 300 s devant la lecture de fiche : ~0 lecture MongoDB pour les fiches chaudes. Invalidation par `DEL` à l'écriture et par les Change Streams ; 300 s bornent l'obsolescence si une invalidation est perdue.
- **Limites.** Les `specs.v` hétérogènes (nombre ou texte) imposent des valeurs typées par clé côté application : le `type` de `categories.facets` dit quel type attendre pour chaque clé. La recherche plein texte (`$text`) reste basique ([contexte et synthèse](00-contexte-synthese.md)).
