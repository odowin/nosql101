# Schéma d'architecture globale

![Architecture globale](architecture-globale.drawio.svg)

## Lecture du schéma

**Flux synchrones (traits pleins)** — le parcours d'une requête utilisateur :

1. Le **load balancer** répartit le trafic entre plusieurs **serveurs web sans état** : aucun serveur ne garde de session en mémoire, on peut en ajouter ou en perdre un sans impact pour le client.
2. L'**API** interroge la base adaptée à chaque besoin :
   - fiche produit → **MongoDB** ;
   - panier, session → **Redis** (c'est ce qui rend les serveurs web sans état) ;
   - chaque page vue, clic, recherche → écrit dans **Cassandra** ;
   - « produits compatibles », « achetés ensemble » → **Neo4j** ;
   - validation de commande et paiement → **SGBDR existant** (transactions ACID, hors périmètre).

**Flux asynchrones (pointillés)** — ce qui n'a pas besoin d'être immédiat :

- les modifications du catalogue (change streams MongoDB) mettent à jour les nœuds produits dans Neo4j ;
- les commandes validées sont copiées dans Cassandra (historique client) et alimentent les relations « achetés ensemble » dans Neo4j ;
- des jobs Spark lisent les logs bruts de Cassandra et écrivent les agrégats (top produits de la semaine).

## Pourquoi ce découpage

- **Une base par besoin** (persistance polyglotte) : la démarche complète est dans [docs/choix-technologiques.md](../docs/choix-technologiques.md).
- **Chaque base a sa propre position CAP** : CP pour le catalogue et le graphe, AP pour le panier et les logs. Une panne d'une base n'arrête pas les autres : si Neo4j est indisponible, le site vend toujours, sans recommandations.
- **Les données dérivées sont asynchrones** : Neo4j et les agrégats peuvent avoir quelques minutes de retard sans conséquence métier, ce qui évite de ralentir le parcours d'achat.

## Modifier le schéma

Fichier `architecture-globale.drawio.svg` : c'est une image SVG qui contient aussi la source draw.io.

- VS Code : extension *Draw.io Integration* (`hediet.vscode-drawio`), ouvrir le fichier directement.
- Navigateur : https://app.diagrams.net → *Open Existing Diagram* → GitHub, ou glisser-déposer le fichier.
- Toujours enregistrer en `.drawio.svg`. Une seule personne modifie le fichier à la fois (le diff n'est pas lisible).

Les schémas de chaque lot sont en Mermaid, directement dans [docs/conception/](../docs/conception/).
