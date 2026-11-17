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

Pour un nouveau sujet : `git switch develop && git pull && git switch -c <type>/<sujet>`.

## Cycle de travail

1. Récupérer la branche à jour : `git switch lot1/catalogue-produits && git pull`.
2. Commiter souvent, par petites étapes (l'historique est noté).
3. Pousser : `git push`.
4. Ouvrir une Pull Request **vers `develop`** et demander une relecture à un autre membre.
5. Une fois `develop` stable, PR `develop` → `main` pour le rendu.

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
