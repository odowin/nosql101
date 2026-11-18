# Lot 3 — Logs et analytics

> Besoin et contraintes : voir [sujet](../sujet.md).

## Choix technologique

Place dans l'architecture : [architecture](../../architecture/README.md) (flux ③ événements et ④ commandes) ; contexte et synthèse des compromis dans [00-contexte-synthese.md](00-contexte-synthese.md).

| Lot | Techno | Modèle | CAP (sous partition) | Justification métier |
|---|---|---|---|---|
| 3 Logs/analytics | Cassandra 5.0, 2 DC × 3, RF=3 | Colonnes larges | AP, cohérence réglable | écritures massives, rétention longue, scalabilité linéaire |

**Pourquoi Cassandra.**
- Écritures en LSM-tree (commit log séquentiel + memtable) : chaque clic est une écriture bon marché.
- Architecture sans maître et scalabilité linéaire : on ajoute des nœuds.
- TTL par ligne + **TimeWindowCompactionStrategy** : les fenêtres expirées sont supprimées en bloc. Fenêtre de 7 jours, soit ~57 SSTables sur 13 mois (cible : quelques dizaines ; une fenêtre d'un jour en donnerait ~400).
- Réplication multi-DC native.

Volumétrie brute : 5 M × ~400 o × 396 j ≈ 0,8 To, soit ~2,4 To par DC avec RF=3.

| Alternative | Rejet |
|---|---|
| MongoDB time series | adapté, mais les écritures passent par un seul primaire par shard et le multi-DC actif-actif manque |
| Elasticsearch | excellent pour la recherche dans les logs, mais coûteux en stockage indexé sur 13 mois, et la durabilité n'est pas sa vocation |
| Entrepôt (BigQuery, ClickHouse…) | idéal pour l'**ad hoc**, mais ne sert pas des lectures unitaires temps réel (historique client) ; il est prévu en aval (data lake, voir [synthèse](00-contexte-synthese.md)) |

## Schéma de données

_À compléter._

## Requêtes types

_À compléter._

## Justification des compromis

_À compléter (CAP, patterns, Query-Driven)._
