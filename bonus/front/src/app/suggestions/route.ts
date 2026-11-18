import { NextResponse, type NextRequest } from "next/server";
import { getTopSearches, listProducts } from "@/lib/api/client";
import type { PriceInfo } from "@/lib/api/types";

export type Suggestions = {
  queries: string[];
  products: (PriceInfo & { sku: string; name: string; category: string; categoryId: string })[];
};

/**
 * Suggestions de la recherche, côté serveur pour ne pas exposer l'API au navigateur :
 * requêtes populaires contenant le terme (GET /analytics/top-searches) + 3 produits (GET /products?q=&limit=3).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 64);
  const empty: Suggestions = { queries: [], products: [] };
  if (q.length < 2) return NextResponse.json(empty);
  const [searches, first] = await Promise.all([
    getTopSearches(50).catch(() => []), // API absente : pas de suggestion plutôt qu'une erreur sous le champ
    listProducts({ q, limit: 3 }).catch(() => null),
  ]);
  const t = q.toLowerCase();
  const queries = searches.map((s) => s.search_query).filter((s) => s.toLowerCase().includes(t)).slice(0, 5);
  // La recherche texte de l'API porte sur des mots entiers : pour un début de mot (« ry »), on prend les produits de la 1re requête suggérée.
  const page = first?.items.length || !queries.length ? first : await listProducts({ q: queries[0], limit: 3 }).catch(() => null);
  const body: Suggestions = {
    queries,
    products: (page?.items ?? []).map((p) => ({
      sku: p._id,
      name: p.name,
      category: p.category.name,
      categoryId: p.category._id,
      price: p.price,
      effective_price: p.effective_price,
      on_sale: p.on_sale,
      discount_percent: p.discount_percent,
      promo: p.promo,
    })),
  };
  return NextResponse.json(body);
}
