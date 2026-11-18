// Formes des réponses, relevées dans api/app/*.py : l'API ne déclare pas de response_model,
// donc schema.d.ts type les réponses en `unknown`. Seuls les champs utiles au front sont listés.

export type Spec = { k: string; v: string | number | boolean; label?: string; u?: string };

export type ProductSummary = {
  _id: string;
  name: string;
  slug: string;
  category: { _id: string; name: string; path: string };
  brand: { _id: string; name: string };
  range?: string;
  price: number;
  stock?: { status: string; qty?: number };
  rating: { avg: number; count: number };
};

export type Review = {
  _id: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  created_at: string;
  verified_purchase?: boolean;
};

export type Product = ProductSummary & {
  specs: Spec[];
  top_reviews: Review[];
  compatible: { sku: string; name: string }[];
};

export type Page<T> = { total: number; items: T[] };

export type Category = { _id: string; name: string; parent: string | null; children: Category[] };

export type Session = { session_id: string; cart_id: string; customer_id?: string; ttl: number };

export type CartLine = { sku: string; name: string; unit_price: number; quantity: number; line_total: number };
export type Cart = { cart_id: string; items: CartLine[]; total: number; ttl: number };

export type Order = {
  order_id: string;
  customer_id: string;
  order_date: string;
  status: string;
  total: number;
  items: { sku: string; name: string; quantity: number; unit_price: number }[];
};

export type TopProducts = {
  period: string;
  computed_at: string;
  items: { rank: number; sku: string; name: string | null; views: number }[];
};
export type TopSearch = { search_query: string; searches: number };
export type DailyViews = { day: string; views: number }[];

export type Recommendation = { sku: string; name: string; price: number; category?: string };
export type RecoKind = "also-bought" | "bought-together" | "compatible" | "similar";
