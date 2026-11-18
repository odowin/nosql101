# Front LDLC

Interface Next.js (App Router) de la refonte : catalogue, panier, commandes, analytics. Elle consomme uniquement l'[API FastAPI](../../api/README.md), jamais les bases.

## Lancer

Avec Docker (API, bases et front) :

```bash
docker compose up -d --build   # front sur http://localhost:3000, Swagger sur http://localhost:8000/docs
```

En local, contre une API déjà lancée sur `localhost:8000` :

```bash
cd bonus/front
cp .env.example .env.local     # API_URL=http://localhost:8000
npm ci
npm run dev
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | serveur de dev, build (standalone), production |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run api:types` | régénère `src/lib/api/schema.d.ts` depuis `openapi.json` |

## Régénérer les types

Avec l'API lancée : `curl http://localhost:8000/openapi.json -o openapi.json && npm run api:types`.

## Organisation

- `src/app/` : routes (`/`, `/produits`, `/produits/[sku]`, `/panier`, `/compte`, `/commandes`, `/analytics`).
- `src/components/` : composants métier (en-tête, méga-menu des catégories, pied de page…) ; `ui/` : composants shadcn.
- Thème : sombre unique, tokens `oklch()` dans `globals.css`. Dans l'en-tête, BOUTIQUES mène à `/analytics` (pas de boutique physique) et AIDE au Swagger publié sur `localhost:8000`.
- `src/lib/api/` : client `openapi-fetch` typé ; `src/lib/session.ts` : session (cookie) ; `format.ts`, `daily-views.ts` : utilitaires testés.
- `API_URL` : adresse de l'API côté serveur. Elle est aussi figée au build pour les rewrites (`ARG API_URL` du Dockerfile).
