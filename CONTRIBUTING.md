# Workflow de l'équipe

## Branches

| Branche                      | Rôle                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `main`                       | Version rendue. Protégée : on n'y pousse jamais directement, uniquement via Pull Request. |
| `develop`                    | Branche d'intégration. Les branches de travail partent d'ici et y reviennent.             |
| `lot1/catalogue-produits`    | Lot 1 — MongoDB                                                                           |
| `lot2/panier-sessions`       | Lot 2 — Redis                                                                             |
| `lot3/logs-analytics`        | Lot 3 — Cassandra                                                                         |
| `lot4/recommandations`       | Lot 4 — Neo4j                                                                             |
| `architecture/schema-global` | Schéma d'architecture globale                                                             |
| `release/vX.Y.Z`             | Préparation d'un rendu : créée depuis `develop`, met à jour `CHANGELOG.md`, PR vers `main`, puis tag `vX.Y.Z`. |

Pour un nouveau sujet : `git switch develop && git pull && git switch -c <type>/<sujet>`.

## Cycle de travail

1. Récupérer la branche à jour : `git switch lot1/catalogue-produits && git pull`.
2. Commiter souvent, par petites étapes (l'historique est noté).
3. Pousser : `git push`.
4. Fusionner dans `develop` (merge direct ou Pull Request, au choix).
5. Une fois `develop` stable : `git switch -c release/vX.Y.Z develop`, mise à jour de `CHANGELOG.md`, PR `release/vX.Y.Z` → `main` pour le rendu, puis tag `vX.Y.Z` sur `main`.

## Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<portée>): <description courte>
```

- Types : `feat`, `docs`, `fix`, `refactor`, `chore`.
- Portées : `lot1`, `lot2`, `lot3`, `lot4`, `archi`, `api`, `readme`.

Exemples :

```
docs(lot1): ajoute le schéma de la collection products
feat(api): endpoint GET /products/:id
docs(lot3): justifie le choix de la partition key
```
