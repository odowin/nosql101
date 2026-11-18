import type { ProductQuery } from "./api/client";

export const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const all = (v: string | string[] | undefined) => [v ?? []].flat().map((s) => s.trim()).filter(Boolean);

function price(v: string | string[] | undefined) {
  const s = first(v);
  const n = Number(s?.replace(",", "."));
  return s && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Paramètres d'URL de /produits → requête GET /products (spec=k:v répétable, page → skip). */
export function parseCatalogFilters(sp: SearchParams): ProductQuery {
  const page = Math.max(1, Math.trunc(Number(first(sp.page))) || 1);
  return {
    category: first(sp.category),
    brand: all(sp.brand),
    q: first(sp.q),
    min_price: price(sp.min_price),
    max_price: price(sp.max_price),
    on_sale: first(sp.on_sale) === "true" || undefined,
    // Une spec sans « k:v » ferait répondre 400 à l'API : on l'ignore.
    spec: all(sp.spec).filter((s) => /^[^:]+:.+$/.test(s)),
    limit: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  };
}
