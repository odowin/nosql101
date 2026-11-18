# Lot 1 — Catalogue produits

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

**MongoDB** — base documentaire.

| Contrainte du sujet | Réponse MongoDB |
|---|---|
| Schémas variables selon les catégories | document BSON sans schéma fixe : le champ `caracteristiques` diffère d'une famille à l'autre sans table d'altération |
| Évolution sans migration | ajouter un attribut = ajouter une clé ; `schema_version` versionne les évolutions structurelles |
| Lecture très fréquente, écriture rare | une fiche = un document = **une seule lecture** ; aucune jointure pour afficher une page produit |
| Sous-documents (avis, specs, compatibilités) | *embedding* natif, tableaux interrogeables et indexables |

**Alternatives écartées**

| Technologie | Raison de l'écart |
|---|---|
| Relationnel (PostgreSQL) | 500+ attributs répartis sur 30 familles → tables d'attributs, `EAV` ou colonnes majoritairement nulles ; migrations à chaque nouvelle catégorie |
| Colonne (Cassandra) | optimisée pour l'écriture massive, pas pour des filtres arbitraires sur des attributs variables ; le catalogue est lu 100× plus qu'écrit |
| Clé-valeur (Redis) | aucun requêtage par contenu ni index secondaire ; réservé au lot 2 |
| Graphe (Neo4j) | pertinent pour les compatibilités (lot 4), pas pour stocker 27 000 fiches |

**Position CAP.** MongoDB est **CP** en replica set avec `w: "majority"` : le catalogue ne tolère pas de fiche fantôme ni de prix incohérent entre nœuds. La disponibilité en lecture peut être relâchée (`readPreference: "secondaryPreferred"`) au prix d'une désynchronisation de quelques centaines de millisecondes, acceptable pour des pages catalogue. Le choix est donc *CP par défaut, AP en lecture* — un compromis explicite.

**Démarche Query-Driven.** Le schéma est dérivé des requêtes réelles (fiche produit, page de liste, filtres à facettes), pas d'un modèle normalisé. Chaque décision d'*embedding* est justifiée par une requête de la section suivante.

## Schéma de données

### Vue d'ensemble

| Collection | Rôle | Volumétrie |
|---|---|---|
| `produits` | fiches produits, document polymorphe | ~27 000 |
| `categories` | arbre taxonomique et définition des facettes | ~50 nœuds |

Deux collections seulement : les avis complets iront dans Cassandra (lot 3), les compatibilités dans Neo4j (lot 4), les compteurs de stock dans Redis (lot 2). Le document `produits` est **la source de vérité** du contenu et des prix.

### Taxonomie

Trois niveaux, codes en `kebab-case` stables, libellés dans la collection `categories`.

```
univers (7)  →  catégorie  →  sous-catégorie
```

| Univers | Catégories |
|---|---|
| `informatique` | `composants`, `peripheriques`, `stockage-externe`, `reseau`, `ordinateurs`, `mobilier`, `logiciels`, `accessoires` |
| `image-son` | `television`, `projection`, `home-cinema`, `hifi`, `photo`, `camera`, `drone` |
| `telephonie-auto` | `smartphone`, `telephone-fixe`, `voip`, `autoradio`, `dashcam` |
| `jeux-loisirs` | `console`, `jeu-video`, `manette`, `accessoire-console` |
| `objets-connectes` | `maison-connectee`, `securite`, `sport-sante`, `montre-connectee` |
| `consommables` | `cartouche-encre`, `toner`, `papier`, `pile-batterie` |
| `connectique` | `cable-hdmi`, `cable-rj45`, `cable-usb`, `multiprise`, `outillage` |

Deux points de modélisation volontaires :

- **« Reconditionnés » n'est pas un univers.** Un PC reconditionné reste un PC : il garde son `univers`/`categorie` d'origine et porte `etat: "reconditionne"` + `produit_parent`. Le menu « Reconditionnés » est une **vue filtrée** (`etat != neuf`), pas une branche de l'arbre.
- **`boitier-pc` est un composant**, `armoire-reseau` et `meuble-baie` sont du `mobilier` : ce sont deux natures d'objet différentes malgré le mot « meuble ».

### Document `produits`

```jsonc
{
  "_id": ObjectId("6743a1f2c8e4b91d3a7f0e21"),
  "schema_version": 1,

  // --- Identité -----------------------------------------------------------
  "reference": "AR202309150042",          // clé métier, unique
  "sku": "LDLC-RTX4070-ASUS-12G",
  "ean": "4711081234567",
  "mpn": "DUAL-RTX4070-O12G",
  "slug": "asus-dual-geforce-rtx-4070-oc-12-go",

  // --- Contenu ------------------------------------------------------------
  "nom": "ASUS Dual GeForce RTX 4070 OC 12 Go",
  "marque": { "id": "asus", "nom": "ASUS" },
  "description_courte": "Carte graphique PCI-Express 4.0 x16, 12 Go GDDR6X, double ventilateur.",
  "description_longue": "L'ASUS Dual GeForce RTX 4070 OC embarque 12 Go de GDDR6X et l'architecture NVIDIA Ada Lovelace…",
  "points_forts": ["Ray tracing 3e génération", "DLSS 3", "12 Go GDDR6X"],
  "mots_cles": ["rtx", "nvidia", "gaming", "4070"],

  // --- Classement ---------------------------------------------------------
  "univers": "informatique",
  "categorie": "composants",
  "sous_categorie": "carte-graphique",
  "chemin_categorie": ["informatique", "composants", "carte-graphique"],
  "fil_ariane": [
    { "code": "informatique",   "libelle": "Informatique" },
    { "code": "composants",     "libelle": "Composants" },
    { "code": "carte-graphique","libelle": "Carte graphique" }
  ],
  "tags": ["gamer"],

  // --- Nature -------------------------------------------------------------
  "etat": "neuf",
  "grade": null,
  "type_objet": "materiel",
  "garantie_mois": 24,
  "produit_parent": null,

  // --- Prix ---------------------------------------------------------------
  "prix": {
    "devise": "EUR",
    "ht":      NumberDecimal("499.17"),
    "ttc":     NumberDecimal("599.00"),
    "tva":     NumberInt(20),
    "prix_barre_ttc": NumberDecimal("649.00"),
    "ecotaxe":        NumberDecimal("1.50"),
    "promo": {
      "active": true,
      "debut": ISODate("2026-11-15T00:00:00Z"),
      "fin":   ISODate("2026-12-01T00:00:00Z"),
      "libelle": "Black Friday"
    }
  },

  // --- Stock --------------------------------------------------------------
  "stock": {
    "quantite": NumberInt(12),
    "disponibilite": "en_stock",
    "delai_livraison_jours": NumberInt(2),
    "magasins": [
      { "magasin_id": "lyon-1",  "quantite": NumberInt(3) },
      { "magasin_id": "paris-2", "quantite": NumberInt(1) }
    ]
  },

  // --- Médias -------------------------------------------------------------
  "medias": {
    "image_principale": "https://cdn.ldlc.example/rtx4070/1.jpg",
    "images": ["https://cdn.ldlc.example/rtx4070/2.jpg"],
    "documents": [{ "type": "notice", "url": "https://cdn.ldlc.example/rtx4070/notice.pdf" }]
  },

  // --- Spécifications (polymorphes) --------------------------------------
  "caracteristiques": {
    "chipset": "GeForce RTX 4070",
    "constructeur_gpu": "NVIDIA",
    "memoire_go": 12,
    "type_memoire": "GDDR6X",
    "bus_memoire_bits": 192,
    "interface": "PCI-Express 4.0 x16",
    "frequence_boost_mhz": 2550,
    "longueur_mm": 267,
    "epaisseur_slots": 2,
    "tdp_w": 200,
    "alim_recommandee_w": 650,
    "sorties": ["HDMI 2.1", "DisplayPort 1.4a x3"]
  },
  "attributs_filtrables": [
    { "cle": "memoire_go",       "valeur": 12,     "unite": "Go"  },
    { "cle": "type_memoire",     "valeur": "GDDR6X" },
    { "cle": "interface",        "valeur": "PCI-Express 4.0 x16" },
    { "cle": "tdp_w",            "valeur": 200,    "unite": "W"   },
    { "cle": "longueur_mm",      "valeur": 267,    "unite": "mm"  }
  ],

  // --- Physique -----------------------------------------------------------
  "physique": {
    "poids_kg": 1.2,
    "dimensions_cm": { "longueur": 26.7, "largeur": 12.0, "hauteur": 5.0 },
    "couleur": "Noir"
  },

  // --- Relations ----------------------------------------------------------
  "compatibilites": ["pcie-4.0", "alim-650w"],
  "variantes": [],
  "accessoires": [],

  // --- Avis (subset + computed) ------------------------------------------
  "avis": {
    "note_moyenne": 4.7,
    "nombre": NumberInt(132),
    "derniers": [
      {
        "auteur": "Lucas",
        "note": NumberInt(5),
        "texte": "Silencieuse et très performante en 1440p.",
        "date": ISODate("2026-10-02T00:00:00Z")
      }
    ]
  },

  // --- Gestion ------------------------------------------------------------
  "visible": true,
  "date_creation": ISODate("2026-01-10T09:00:00Z"),
  "date_maj":      ISODate("2026-11-18T08:30:00Z")
}
```

### Contrat de champs

| Bloc | Champ | Type | Obl. | Contrainte |
|---|---|---|---|---|
| Méta | `schema_version` | int | ✅ | `1` |
| | `visible` | bool | ✅ | |
| | `date_creation`, `date_maj` | date | ✅ | UTC |
| Identité | `reference` | string | ✅ | unique, `^AR[0-9]{12}$` |
| | `sku` | string | ✅ | unique |
| | `ean` | string | ❌ | **absent ou string**, jamais `null` |
| | `mpn` | string | ❌ | |
| | `slug` | string | ✅ | unique, kebab-case |
| Contenu | `nom` | string | ✅ | |
| | `marque` | object | ✅ | `{id, nom}` |
| | `description_courte` | string | ✅ | 10–300 car. |
| | `points_forts` | string[] | ❌ | ≤ 6 |
| | `mots_cles` | string[] | ❌ | indexé en texte |
| Classement | `univers`, `categorie`, `sous_categorie` | string | ✅ | codes kebab-case |
| | `chemin_categorie` | string[] | ✅ | exactement 3 |
| | `fil_ariane` | object[] | ✅ | `{code, libelle}`, 3 entrées |
| Nature | `etat` | string | ✅ | `neuf\|reconditionne\|occasion\|declasse` |
| | `grade` | string \| null | ❌ | `A\|B\|C\|null` |
| | `type_objet` | string | ✅ | `materiel\|logiciel\|service\|pack` |
| | `garantie_mois` | int | ✅ | 0–120 |
| | `produit_parent` | string \| null | ❌ | `reference` d'origine |
| Prix | `prix.ht`, `prix.ttc` | **decimal** | ✅ | ≥ 0 |
| | `prix.tva` | int \| double | ✅ | 5,5 % impose `double` |
| | `prix.prix_barre_ttc`, `prix.ecotaxe` | decimal \| null | ❌ | |
| | `prix.promo` | object \| null | ❌ | `{active, debut, fin, libelle}` |
| Stock | `stock.quantite` | int | ✅ | ≥ 0 |
| | `stock.disponibilite` | string | ✅ | `en_stock\|sur_commande\|rupture\|precommande\|archive` |
| | `stock.magasins` | object[] | ❌ | `{magasin_id, quantite}` |
| Médias | `medias.image_principale` | string | ✅ | `https://` |
| | `medias.images`, `medias.documents` | array | ❌ | |
| Specs | `caracteristiques` | object | ✅ | **libre, ≥ 1 propriété** |
| | `attributs_filtrables` | object[] | ✅ | `{cle, valeur, unite?}` |
| Physique | `physique.poids_kg` | double | ❌ | |
| | `physique.dimensions_cm` | object | ❌ | `{longueur, largeur, hauteur}` |
| Relations | `compatibilites`, `variantes`, `accessoires` | array | ❌ | codes / refs |
| Avis | `avis.note_moyenne` | double | ✅ | 0–5, **calculé** |
| | `avis.nombre` | int | ✅ | **calculé** |
| | `avis.derniers` | object[] | ✅ | ≤ 5, **subset** |

**Choix d'identifiants.** `_id` reste un `ObjectId` généré par le serveur, et la clé métier est `reference` avec un index unique. Un `_id` métier (la référence en string) aurait rendu la fiche dépendante du format de référence ; l'`ObjectId` porte un timestamp utile et reste stable en cas de renommage de référence.

**Choix de type pour l'argent.** Tous les montants sont en `Decimal128`. Un `double` sur `599.00` produit `598.9999999999999` après quelques opérations, ce qui est inacceptable sur une facture. Le coût est une conversion côté application (`Decimal128` ↔ `Decimal` Python), assumé.

**Type de la TVA.** `["int", "double"]` et non `int` seul : la France applique 5,5 % sur certains produits (livres, logiciels grand public). Un `int` rejetterait ces fiches.

### Validation — `$jsonSchema`

```js
db.createCollection("produits", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "schema_version","reference","sku","slug","nom","marque",
        "description_courte","univers","categorie","sous_categorie",
        "chemin_categorie","fil_ariane","etat","type_objet","garantie_mois",
        "prix","stock","medias","caracteristiques","attributs_filtrables",
        "avis","visible","date_creation","date_maj"
      ],
      properties: {
        schema_version: { bsonType: "int", enum: [1] },
        reference: { bsonType: "string", pattern: "^AR[0-9]{12}$" },
        sku: { bsonType: "string", minLength: 3 },
        ean: { bsonType: "string", pattern: "^[0-9]{8,14}$" },
        mpn: { bsonType: "string", minLength: 1 },
        slug: { bsonType: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
        nom: { bsonType: "string", minLength: 3 },
        marque: {
          bsonType: "object",
          required: ["id","nom"],
          properties: {
            id:  { bsonType: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
            nom: { bsonType: "string", minLength: 1 }
          }
        },
        description_courte: { bsonType: "string", minLength: 10, maxLength: 300 },
        description_longue: { bsonType: "string" },
        points_forts: { bsonType: "array", items: { bsonType: "string" }, maxItems: 6 },
        mots_cles: { bsonType: "array", items: { bsonType: "string" } },
        univers: { enum: ["informatique","image-son","telephonie-auto","jeux-loisirs",
                          "objets-connectes","consommables","connectique"] },
        categorie: { bsonType: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
        sous_categorie: { bsonType: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" },
        chemin_categorie: { bsonType: "array", items: { bsonType: "string" },
                            minItems: 3, maxItems: 3 },
        fil_ariane: {
          bsonType: "array", minItems: 3,
          items: {
            bsonType: "object", required: ["code","libelle"],
            properties: { code: { bsonType: "string" }, libelle: { bsonType: "string" } }
          }
        },
        tags: { bsonType: "array", items: { bsonType: "string" } },
        etat: { enum: ["neuf","reconditionne","occasion","declasse"] },
        grade: { bsonType: ["string","null"], enum: ["A","B","C",null] },
        type_objet: { enum: ["materiel","logiciel","service","pack"] },
        garantie_mois: { bsonType: "int", minimum: 0, maximum: 120 },
        produit_parent: { bsonType: ["string","null"] },
        prix: {
          bsonType: "object",
          required: ["devise","ht","ttc","tva"],
          properties: {
            devise: { enum: ["EUR"] },
            ht:  { bsonType: "decimal", minimum: 0 },
            ttc: { bsonType: "decimal", minimum: 0 },
            tva: { bsonType: ["int","double"], minimum: 0, maximum: 100 },
            prix_barre_ttc: { bsonType: ["decimal","null"] },
            ecotaxe: { bsonType: ["decimal","null"] },
            promo: {
              bsonType: ["object","null"],
              required: ["active"],
              properties: {
                active:  { bsonType: "bool" },
                debut:   { bsonType: "date" },
                fin:     { bsonType: "date" },
                libelle: { bsonType: "string" }
              }
            }
          }
        },
        stock: {
          bsonType: "object",
          required: ["quantite","disponibilite"],
          properties: {
            quantite: { bsonType: "int", minimum: 0 },
            disponibilite: { enum: ["en_stock","sur_commande","rupture","precommande","archive"] },
            delai_livraison_jours: { bsonType: ["int","null"], minimum: 0 },
            magasins: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["magasin_id","quantite"],
                properties: {
                  magasin_id: { bsonType: "string" },
                  quantite: { bsonType: "int", minimum: 0 }
                }
              }
            }
          }
        },
        medias: {
          bsonType: "object",
          required: ["image_principale"],
          properties: {
            image_principale: { bsonType: "string", pattern: "^https://" },
            images: { bsonType: "array", items: { bsonType: "string", pattern: "^https://" } },
            documents: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["type","url"],
                properties: {
                  type: { enum: ["notice","fiche_technique","manuel","pilote"] },
                  url:  { bsonType: "string", pattern: "^https://" }
                }
              }
            }
          }
        },
        caracteristiques: { bsonType: "object", minProperties: 1 },
        attributs_filtrables: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["cle","valeur"],
            properties: {
              cle:    { bsonType: "string", pattern: "^[a-z0-9]+(_[a-z0-9]+)*$" },
              valeur: { bsonType: ["string","int","double","bool","decimal"] },
              unite:  { bsonType: "string", maxLength: 8 }
            }
          }
        },
        physique: {
          bsonType: ["object","null"],
          properties: {
            poids_kg: { bsonType: ["double","int","null"], minimum: 0 },
            dimensions_cm: {
              bsonType: "object",
              properties: {
                longueur: { bsonType: ["double","null"] },
                largeur:  { bsonType: ["double","null"] },
                hauteur:  { bsonType: ["double","null"] }
              }
            },
            couleur: { bsonType: "string" }
          }
        },
        compatibilites: { bsonType: "array", items: { bsonType: "string" } },
        variantes: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["reference","libelle"],
            properties: {
              reference: { bsonType: "string" },
              libelle:   { bsonType: "string" }
            }
          }
        },
        accessoires: { bsonType: "array", items: { bsonType: "string" } },
        avis: {
          bsonType: "object",
          required: ["note_moyenne","nombre","derniers"],
          properties: {
            note_moyenne: { bsonType: ["double","int"], minimum: 0, maximum: 5 },
            nombre: { bsonType: "int", minimum: 0 },
            derniers: {
              bsonType: "array", maxItems: 5,
              items: {
                bsonType: "object",
                required: ["auteur","note","texte","date"],
                properties: {
                  auteur: { bsonType: "string" },
                  note:   { bsonType: "int", minimum: 1, maximum: 5 },
                  texte:  { bsonType: "string" },
                  date:   { bsonType: "date" }
                }
              }
            }
          }
        },
        visible: { bsonType: "bool" },
        date_creation: { bsonType: "date" },
        date_maj:      { bsonType: "date" }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

`validationLevel: "moderate"` valide les écritures sur les documents existants conformes sans bloquer la reprise d'anciens documents. `validationAction` est passé en `"warn"` pendant le prototypage (phase de validation dans Compass) puis en `"error"` : c'est la base elle-même qui refuse une fiche sans `reference` ou avec un prix en `string`.

Le validateur **rend le document auto-vérifiant** : 24 champs obligatoires, des `pattern` sur les codes, un `enum` sur chaque vocabulaire contrôlé. Une fiche incomplète est rejetée à l'insertion, pas découverte six mois plus tard.

### Index

```js
db.produits.createIndex({ reference: 1 }, { unique: true });
db.produits.createIndex({ slug: 1 },      { unique: true });
db.produits.createIndex({ sku: 1 },       { unique: true });
db.produits.createIndex({ ean: 1 },       { unique: true,
  partialFilterExpression: { ean: { $type: "string" } } });

db.produits.createIndex({ chemin_categorie: 1, etat: 1 });
db.produits.createIndex({ categorie: 1, "prix.ttc": 1 });
db.produits.createIndex({ "marque.id": 1 });
db.produits.createIndex({ "stock.disponibilite": 1 });
db.produits.createIndex({ "avis.note_moyenne": -1, "avis.nombre": -1 });

// Pattern Attribute : un seul index pour TOUS les filtres techniques
db.produits.createIndex({ "attributs_filtrables.cle": 1, "attributs_filtrables.valeur": 1 });

db.produits.createIndex(
  { nom: "text", description_courte: "text", mots_cles: "text" },
  { default_language: "french", weights: { nom: 10, mots_cles: 5, description_courte: 1 } }
);
```

| Index | Requête servie |
|---|---|
| `reference`, `slug`, `sku` | accès direct à une fiche, unicité |
| `ean` *partiel* | unicité sans pénaliser les fiches sans code-barres |
| `chemin_categorie + etat` | navigation et vue « reconditionnés » |
| `categorie + prix.ttc` | page de liste triée par prix |
| `attributs_filtrables.*` | **tous** les filtres de facettes, quelle que soit la catégorie |
| text | moteur de recherche avec pondération |

L'index `ean` est **partiel** (`$type: "string"`) : sans cela, deux fiches sans EAN entreraient en collision sur `null`. Corollaire règle d'écriture : on **omet** le champ, on ne l'écrit jamais à `null`.

### Polymorphisme : `caracteristiques` par famille

Même document, contenu technique totalement différent — c'est le cœur du modèle.

```jsonc
// Processeur
{ "socket": "AM5", "architecture": "Zen 4", "gravure_nm": 5, "coeurs": 8, "threads": 16,
  "frequence_base_ghz": 4.2, "frequence_boost_ghz": 5.0, "cache_l3_mo": 32,
  "tdp_w": 120, "pcie_version": "5.0", "memoire_type": "DDR5",
  "frequence_memoire_max_mhz": 5200, "graphique_integre": "Radeon Graphics",
  "debloque": true, "ventirad_inclus": false }

// Alimentation
{ "puissance_w": 850, "certification_80plus": "Gold", "modularite": "full",
  "format": "ATX", "ventilateur_mm": 135, "atx3": true,
  "connecteurs": ["ATX 24 broches", "EPS 8 broches x2", "PCIe 8 broches x4"],
  "profondeur_mm": 160, "bruit_db": 24 }

// Chaise de bureau — aucun champ informatique, et c'est normal
{ "type": "chaise", "materiau": "tissu", "charge_max_kg": 120,
  "hauteur_assise_min_cm": 45, "hauteur_assise_max_cm": 55,
  "accoudoirs": true, "roulettes": true, "largeur_cm": 66 }

// Licence logicielle
{ "edition": "Famille", "duree_mois": 12, "postes": 5,
  "plateforme": ["Windows","macOS"], "langue": ["FR"],
  "livraison": "cle", "type_licence": "abonnement" }
```

Familles couvertes et attributs discriminants :

| Famille | Attributs clés de `caracteristiques` |
|---|---|
| `processeur` | socket, coeurs, threads, frequence_boost_ghz, cache_l3_mo, tdp_w, pcie_version, memoire_type |
| `carte-graphique` | chipset, memoire_go, type_memoire, bus_memoire_bits, interface, longueur_mm, tdp_w, alim_recommandee_w |
| `carte-mere` | socket, chipset, format, memoire_type, slots_memoire, ports_m2, lan_debit, wifi |
| `memoire-ram` | type, capacite_totale_go, nombre_barrettes, frequence_mhz, latence_cl, format, ecc |
| `stockage-interne` | technologie, capacite_go, format, interface, protocole, lecture_mo_s, endurance_tbw |
| `alimentation` | puissance_w, certification_80plus, modularite, format, atx3, bruit_db |
| `boitier-pc` | formats_carte_mere, longueur_gpu_max_mm, hauteur_ventirad_max_mm, baies_3_5, panneau |
| `refroidissement` | type, sockets, tdp_supporte_w, hauteur_mm, radiateur_mm, rpm_max, bruit_db |
| `ecran` | diagonale_pouces, resolution, dalle, frequence_hz, temps_reponse_ms, luminosite_nits, vesa_mm |
| `clavier` | type, switch, layout, connexion, retroeclairage, rollover |
| `souris` | capteur, dpi_max, polling_hz, boutons, connexion, poids_g |
| `casque-audio` | type, transducteur_mm, impedance_ohm, connexion, micro, surround |
| `hub-usb` / `dock-station` | ports_entree, ports_sortie, puissance_pd_w, debit_gbps |
| `ssd-externe` / `hdd-externe` / `cle-usb` | technologie, capacite_go, interface, debit_mo_s, chiffrement |
| `routeur` | wifi_norme, bandes, debit_gbps, ports, vpn, mesh |
| `switch` | ports_nombre, vitesse, poe, budget_poe_w, manageable, rack |
| `nas` | baies, raid, cpu, ram_go, protocoles, rack |
| `armoire-reseau` / `meuble-baie` | hauteur_u, largeur_mm, profondeur_mm, charge_max_kg, norme |
| `onduleur` | puissance_va, puissance_w, technologie, autonomie_min, forme_signal |
| `pc-desktop` / `pc-portable` | cpu, gpu, ram_go, stockage, os, batterie_wh, poids_kg |
| `logiciels` | edition, duree_mois, postes, plateforme, livraison |
| `mobilier` | type, materiau, charge_max_kg, hauteur_assise_min_cm, roulettes |
| `image-son` | diagonale_pouces, resolution, dalle, hdr, luminosite_lumens, puissance_w_rms |
| `smartphone` | ecran_pouces, chipset, ram_go, photo_mp, batterie_mah, cinq_g, etancheite_ip |
| `console` / `jeu-video` / `manette` | stockage_go, plateforme, genre, pegi, connexion |
| `objets-connectes` | protocole, compatibilites, alimentation, hub_requis |
| `consommables` | type, compatible_avec, rendement_pages, couleur |
| `connectique` | connecteur_a, connecteur_b, longueur_m, norme, debit_gbps |

**Convention de nommage.** `snake_case`, unité en suffixe (`_go`, `_mm`, `_w`, `_mhz`, `_ghz`, `_mo`, `_cm`, `_h`, `_ms`, `_hz`, `_pouces`). Une valeur numérique ne s'écrit **jamais** en chaîne avec son unité : l'unité va dans `attributs_filtrables.unite`, ce qui permet les comparaisons numériques.

### Dérivation `caracteristiques` → `attributs_filtrables`

Règle appliquée à chaque écriture, jamais l'un sans l'autre :

| Valeur dans `caracteristiques` | Attribut filtrable ? | `valeur` | `unite` |
|---|---|---|---|
| nombre + unité (`memoire_go`) | ✅ | int / double | `Go` |
| booléen (`poe`, `rgb`) | ✅ | bool | — |
| énumération courte (`dalle`, `format`) | ✅ | string | — |
| nombre sans dimension (`coeurs`) | ✅ | int | — |
| texte libre | ❌ | — | — |
| tableau (`sorties`, `sockets`) | ⚠️ une entrée par valeur | string | — |

Seuls les attributs **déclarés comme filtres dans `categories`** sont projetés : `carte-graphique` déclare 5 filtres, donc 5 entrées, pas 12. Sans cette règle, l'index multikey gonfle inutilement et les facettes affichent des valeurs sans intérêt.

### Collection `categories`

```jsonc
{
  "_id": ObjectId("6743a1f2c8e4b91d3a7f0e99"),
  "code": "carte-graphique",
  "libelle": "Carte graphique",
  "niveau": 3,
  "parent_code": "composants",
  "chemin": ["informatique", "composants", "carte-graphique"],
  "univers": "informatique",
  "ordre": 30,
  "actif": true,
  "filtres": [
    { "cle": "memoire_go",   "libelle": "Mémoire vidéo",   "type": "nombre", "unite": "Go", "ordre": 1 },
    { "cle": "type_memoire", "libelle": "Type de mémoire", "type": "enum",   "ordre": 2 },
    { "cle": "interface",    "libelle": "Interface",       "type": "enum",   "ordre": 3 },
    { "cle": "tdp_w",        "libelle": "Consommation",    "type": "nombre", "unite": "W",  "ordre": 4 },
    { "cle": "longueur_mm",  "libelle": "Longueur",        "type": "nombre", "unite": "mm", "ordre": 5 }
  ]
}
```

```js
db.categories.createIndex({ code: 1 },            { unique: true });
db.categories.createIndex({ parent_code: 1, ordre: 1 });
db.categories.createIndex({ chemin: 1 });
db.categories.createIndex({ univers: 1, niveau: 1, ordre: 1 });
```

L'intérêt : la page catégorie construit ses facettes en lisant `filtres`, sans code en dur. Le contrat entre les deux collections est une **clé partagée** (`memoire_go` existe dans `filtres` et dans `attributs_filtrables`).

## Requêtes types

**1 — Fiche produit (une seule lecture, aucune jointure)**

```js
db.produits.findOne(
  { slug: "asus-dual-geforce-rtx-4070-oc-12-go" },
  { attributs_filtrables: 0, mots_cles: 0 }
);
```

**2 — Navigation dans une sous-catégorie, tri par prix**

```js
db.produits
  .find({ chemin_categorie: "carte-graphique", visible: true })
  .sort({ "prix.ttc": 1 })
  .skip(0).limit(24);
```

**3 — Filtre à facettes (pattern Attribute)**

```js
db.produits.find({
  chemin_categorie: "carte-graphique",
  attributs_filtrables: { $elemMatch: { cle: "memoire_go", valeur: { $gte: 12 } } }
});
```

**4 — Filtres multiples : `$and` de `$elemMatch` obligatoire**

```js
db.produits.find({
  chemin_categorie: "carte-graphique",
  "stock.disponibilite": "en_stock",
  $and: [
    { attributs_filtrables: { $elemMatch: { cle: "memoire_go", valeur: { $gte: 12 } } } },
    { attributs_filtrables: { $elemMatch: { cle: "tdp_w", valeur: { $lte: 250 } } } }
  ]
});
```

Un seul `$elemMatch` avec deux conditions porterait sur **le même** élément du tableau : il faut un `$elemMatch` par attribut.

**5 — Recherche plein texte pondérée**

```js
db.produits
  .find(
    { $text: { $search: "carte graphique rtx" } },
    { score: { $meta: "textScore" }, nom: 1, "prix.ttc": 1 }
  )
  .sort({ score: { $meta: "textScore" } });
```

**6 — Promotions en cours**

```js
db.produits.find({
  "prix.promo.active": true,
  "prix.promo.fin": { $gt: new Date() }
});
```

**7 — Vue « Reconditionnés » (pas un univers)**

```js
db.produits.find({ etat: { $ne: "neuf" }, visible: true })
           .sort({ "prix.ttc": 1 });
```

**8 — Meilleures notes avec volume minimum (évite les 5/5 sur 1 avis)**

```js
db.produits
  .find({ "avis.nombre": { $gte: 20 } })
  .sort({ "avis.note_moyenne": -1, "avis.nombre": -1 })
  .limit(10);
```

**9 — Facettes dynamiques : comptage par valeur d'attribut**

```js
db.produits.aggregate([
  { $match: { chemin_categorie: "carte-graphique", visible: true } },
  { $unwind: "$attributs_filtrables" },
  { $group: {
      _id: { cle: "$attributs_filtrables.cle", valeur: "$attributs_filtrables.valeur" },
      nb: { $sum: 1 }
  }},
  { $group: {
      _id: "$_id.cle",
      valeurs: { $push: { valeur: "$_id.valeur", nb: "$nb" } }
  }},
  { $sort: { _id: 1 } }
]);
```

**10 — Statistiques par sous-catégorie**

```js
db.produits.aggregate([
  { $match: { univers: "informatique", visible: true } },
  { $group: {
      _id: "$sous_categorie",
      nb: { $sum: 1 },
      prixMoyen: { $avg: "$prix.ttc" },
      prixMin: { $min: "$prix.ttc" }
  }},
  { $sort: { nb: -1 } }
]);
```

**11 — Ajout d'un avis : pattern Computed en une écriture**

```js
db.produits.updateOne(
  { reference: "AR202309150042" },
  [{ $set: {
      "avis.derniers": {
        $slice: [{
          $concatArrays: [[{
            auteur: "Nouvel avis", note: 5, texte: "…", date: new Date()
          }], "$avis.derniers"]
        }, 5]
      },
      "avis.note_moyenne": {
        $divide: [
          { $add: [{ $multiply: ["$avis.note_moyenne", "$avis.nombre"] }, 5] },
          { $add: ["$avis.nombre", 1] }
        ]
      },
      "avis.nombre": { $add: ["$avis.nombre", 1] }
  }}]
);
```

Mise à jour par *pipeline* : les trois champs sont recalculés atomiquement, sans lecture préalable. Le tableau `derniers` reste borné à 5 grâce à `$slice`.

**12 — Vérification du plan d'exécution**

```js
db.produits.find({
  chemin_categorie: "carte-graphique",
  attributs_filtrables: { $elemMatch: { cle: "memoire_go", valeur: { $gte: 12 } } }
}).explain("executionStats");
```

Attendu : `IXSCAN` sur `cat_etat` puis sur `attr_multikey`, et `totalDocsExamined` proche de `nReturned`. C'est la preuve que le pattern Attribute tient sa promesse.

## Justification des compromis

### Embedded vs References

| Donnée | Choix | Requête / raison |
|---|---|---|
| `caracteristiques`, `attributs_filtrables` | **Embedded** | lus à chaque affichage de fiche ; aucune raison de les séparer |
| `prix`, `stock`, `medias`, `physique` | **Embedded** (sous-document) | cohérence atomique : un prix et son éco-taxe se mettent à jour ensemble |
| `marque` | **Extended reference** `{id, nom}` | le nom est lu sur chaque fiche ; le `id` permet de rejoindre la fiche marque du lot 4 |
| `fil_ariane` | **Extended reference** (libellés) | évite 3 lectures pour afficher un fil d'Ariane ; dénormalisation assumée |
| `avis.derniers` | **Subset** (5 max) | la fiche affiche 5 avis ; le reste part dans Cassandra (lot 3) |
| `avis.note_moyenne`, `avis.nombre` | **Computed** | évite un `$avg` sur des milliers d'avis à chaque page |
| `variantes`, `accessoires`, `compatibilites` | **References** (codes / références) | listes ouvertes, taille non bornée, exploitées en graphe au lot 4 |
| `categories` | **Collection séparée** | arbre réutilisé par 27 000 fiches ; le dupliquer serait absurde |

Règle appliquée : on embarque ce qui est **borné, lu avec le parent, et modifié avec lui**. On référence ce qui est **non borné ou partagé**.

### Patterns MongoDB mobilisés

| Pattern | Application | Bénéfice |
|---|---|---|
| **Polymorphic** | `caracteristiques` diffère par famille | une seule collection pour 30 familles, aucune migration |
| **Attribute** | `attributs_filtrables[]` + index multikey | un index unique sert tous les filtres techniques |
| **Extended Reference** | `marque`, `fil_ariane` | supprime les jointures à la lecture |
| **Subset** | `avis.derniers[]` (5) | document borné, fiche complète en une lecture |
| **Computed** | `avis.note_moyenne`, `avis.nombre` | pas d'agrégation à la lecture |
| **Schema Versioning** | `schema_version: 1` | évolution structurelle sans casser les anciens documents |
| **Query-Driven** | index et *embedding* dérivés des 12 requêtes | aucune structure speculative |

### Compromis assumés

| Compromis | Coût | Contrepartie |
|---|---|---|
| Libellés de catégorie dupliqués dans chaque fiche | renommer une catégorie = écriture sur 27 000 documents | fil d'Ariane et facettes sans jointure ; renommage rare |
| `caracteristiques` **et** `attributs_filtrables` (double représentation) | double écriture, risque de désynchronisation | lisibilité humaine + indexabilité ; la règle de dérivation est appliquée par le script d'import |
| `avis.derniers` dupliqué avec la future collection `avis` | 5 avis stockés deux fois | fiche produit autonome ; la duplication est bornée et volontaire |
| `Decimal128` pour les prix | conversions côté application, index plus lourds qu'un entier | exactitude comptable |
| Un seul index texte | pas de recherche par champ isolé | MongoDB n'autorise qu'un index `text` par collection ; la pondération compense |
| Prix et stock dans le même document | écritures de stock plus fréquentes qu'un catalogue | cohérence prix/stock/disponibilité ; le stock temps réel ira dans Redis (lot 2) |

### Position CAP et cohérence

Catalogue = **CP**, `writeConcern: { w: "majority" }`, `readConcern: "majority"` pour les écritures de prix. Les lectures de liste peuvent descendre en `secondaryPreferred` : une fiche vue avec 2 secondes de retard est acceptable, une fiche à un prix faux ne l'est pas. Ce réglage dissocie la cohérence **par usage**, ce qui est le cœur du compromis CAP.

### Volumétrie et montée en charge

27 000 documents de ~4 à 8 Ko représentent **150 à 200 Mo** : l'intégralité du catalogue tient en mémoire. Les index (12) ajoutent ~30 Mo. Aucun sharding n'est nécessaire ; le facteur limitant est la charge de lecture, traitée par réplicas et cache (lot 2), pas par la taille des données.

### Limites du modèle et évolutions prévues

| Limite | Lot | Traitement |
|---|---|---|
| Avis complets (milliers par produit) | 3 — Cassandra | `avis.derniers[]` reste un sous-ensemble |
| Compatibilités et recommandations | 4 — Neo4j | `compatibilites` ne stocke que des codes |
| Compteurs de stock temps réel | 2 — Redis | `stock.quantite` devient la valeur de référence, pas la valeur temps réel |
| Fiches à 50+ variantes | — | *Outlier pattern* : extraction des variantes dans une collection dédiée si un produit dépasse ~20 variantes |
| Recherche à facettes complète | 2 | index posés, UI et cache à venir |

Le modèle du lot 1 est donc **fermé sur lui-même** (une fiche se lit seule) mais **ouvert sur les lots suivants** (chaque champ de relation est déjà un point d'accroche).