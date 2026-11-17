# Projet NoSQL — Refonte LDLC

## Contexte & organisation

### Contexte métier

- **Client :** LDLC (e-commerce high-tech).
- **Problème :** la base relationnelle monolithique ne supporte plus la croissance.
- **Chiffres clés :**
  - plus de **27 000 références** produits ;
  - plus de **600 marques** partenaires ;
  - **millions de visites** mensuelles (pics lors des sorties de composants) ;
  - jusqu'à **25 000 colis** expédiés par jour.
- **Mission :** concevoir l'architecture de données NoSQL de la nouvelle plateforme.

### Organisation du projet

- **Travail en binôme** (2 personnes).
- **Durée :** mardi / mercredi.
- **Dépôt GitHub obligatoire :**
  - un dépôt **par binôme** ;
  - **`README.md` à la racine** avec :
    - nom et prénom des membres ;
    - titre du projet ;
    - description courte de l'architecture ;
    - sommaire des livrables ;
  - tous les livrables versionnés dans le dépôt ;
  - **historique de commits attendu** (pas un seul commit final).

### Périmètre fonctionnel — 4 lots

- **Lot 1 :** Catalogue produits.
- **Lot 2 :** Panier et sessions utilisateurs.
- **Lot 3 :** Logs et analytics.
- **Lot 4 :** Recommandations produits.

> Pour chaque lot : choisir la technologie, concevoir le schéma, justifier les compromis.

## Les 4 lots

### Lot 1 : Catalogue produits

- **Besoin :** stocker des fiches produits avec des **schémas variables** selon les catégories (composants, périphériques, logiciels, etc.).
- **Contraintes :**
  - les fiches doivent évoluer **sans migration** (ajout d'attributs, nouvelles catégories) ;
  - les fiches sont **lues très souvent** et **écrites moins souvent** ;
  - certaines fiches ont des **sous-documents** (avis clients, spécifications techniques, produits compatibles).
- **Attendu :** choix technologique, schéma de données, justification (Embedded vs References, patterns).

### Lot 2 : Panier et sessions utilisateurs

- **Besoin :** gérer les paniers et les sessions de navigation avec une **latence ultra-faible**.
- **Contraintes :**
  - les paniers doivent être **volatils** (expiration automatique après inactivité) ;
  - les sessions doivent être **partagées entre plusieurs serveurs web** ;
  - les performances de lecture/écriture doivent être **submillisecondes**.
- **Attendu :** choix technologique, modèle de données (clés, structures, TTL), justification.

### Lot 3 : Logs et analytics

- **Besoin :** stocker et analyser les logs de navigation (pages vues, clics, recherches) et les historiques de commandes.
- **Contraintes :**
  - volume massif : **des millions d'événements par jour** ;
  - écritures très fréquentes (chaque clic = un log) ;
  - requêtes analytiques : « combien de vues pour ce produit aujourd'hui ? », « top produits consultés cette semaine ? », « historique des commandes d'un client » ;
  - conservation sur plusieurs mois, voire années.
- **Attendu :** choix technologique, schéma de données (Partition Key, Clustering Columns), justification.

### Lot 4 : Recommandations produits

- **Besoin :** suggérer des produits complémentaires ou similaires aux clients.
- **Cas d'usage :**
  - « Les clients qui ont acheté ce processeur ont aussi acheté cette carte mère » ;
  - « Produits compatibles avec ce boîtier ».
- **Contraintes :**
  - relations **complexes** entre produits (compatibilité, gamme, marque) ;
  - besoin de parcours de relations (ex. : amis d'amis, produits similaires).
- **Attendu :** choix technologique, modèle de données (nœuds, arêtes, propriétés), requêtes types.

## Livrables & notation

### Livrables attendus

1. **Dépôt GitHub** (par binôme).
2. **`README.md`** avec les noms des membres.
3. **Schéma d'architecture globale** (diagramme).
4. **Document de conception** (10 pages max) :
   - pour chaque lot : choix technologique, schéma, justification des compromis ;
   - requêtes types avec exemples.
5. **Bonus (optionnel) :** prototype d'API fonctionnel dans le dépôt.

### Grille de notation (sur 20)

| Critère | Points |
|---|---|
| Pertinence des choix technologiques | /4 |
| Qualité de la modélisation Document | /4 |
| Qualité de la modélisation Colonne | /4 |
| Justification des compromis (CAP, patterns) | /3 |
| Qualité du schéma d'architecture | /2 |
| Qualité du dépôt GitHub & README | /1 |
| Bonus (prototype fonctionnel) | /2 |

### Conseils pour les binômes

- **Ne cherchez pas la technologie unique** → persistance polyglotte.
- **Justifiez chaque choix** avec les concepts vus en cours (CAP, patterns, Query-Driven).
- **Pensez aux compromis** : un bon architecte justifie par le besoin métier, pas par la mode.
- **Le README est votre vitrine** : compréhensible en 2 minutes.
- **Committez régulièrement** : un seul commit final sera pénalisé.
