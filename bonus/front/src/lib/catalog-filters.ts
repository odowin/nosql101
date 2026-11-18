import type { ProductQuery } from "./api/client";

export const PAGE_SIZE = 20;

/** Tris proposés (valeur vide = défaut API, par SKU). */
export const SORT_OPTIONS = [
  { value: "", label: "Défaut" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "rating", label: "Note moyenne" },
  { value: "discount", label: "Meilleures remises" },
  { value: "name", label: "Nom (A à Z)" },
] as const;

type Sort = NonNullable<ProductQuery["sort"]>;
const isSort = (v: string | undefined): v is Sort => SORT_OPTIONS.some((o) => o.value && o.value === v);

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
    in_stock: first(sp.in_stock) === "true" || undefined,
    // Un tri inconnu ferait répondre 422 : on retombe sur le défaut.
    sort: isSort(first(sp.sort)) ? (first(sp.sort) as Sort) : undefined,
    // Une spec sans « k:v » ferait répondre 400 à l'API : on l'ignore.
    spec: all(sp.spec).filter((s) => /^[^:]+:.+$/.test(s)),
    limit: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  };
}

/** Numéros de pagination : tout jusqu'à 7 pages, sinon 1, voisins de la page courante, dernière, avec « … » entre les trous. */
export function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = [...new Set([1, current - 1, current, current + 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i && n - keep[i - 1] > 1 ? ["…" as const, n] : [n]));
}
