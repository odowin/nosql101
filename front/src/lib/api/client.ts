import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type * as T from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Message lisible d'une erreur FastAPI : `{detail: "…"}` ou, en 422, `{detail: [{msg}]}`. */
function detailOf(error: unknown): string | undefined {
  const detail = typeof error === "object" && error !== null ? (error as { detail?: unknown }).detail : error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (d as { msg?: string }).msg).join(" ; ");
}

const api = createClient<paths>({
  baseUrl: process.env.API_URL ?? "http://localhost:8000",
  // fetch lu à l'appel : Next le patche (cache) et les tests le remplacent.
  fetch: (request) => fetch(request),
});

async function call<R>(request: Promise<{ data?: unknown; error?: unknown; response: Response }>): Promise<R> {
  let res;
  try {
    res = await request;
  } catch {
    throw new ApiError(503, "API injoignable");
  }
  if (!res.response.ok) throw new ApiError(res.response.status, detailOf(res.error) ?? res.response.statusText);
  return res.data as R;
}

// Catalogue : cache court, invalidé par tag à l'ajout d'un avis. Panier, sessions, analytics : jamais en cache.
const catalog = (...tags: string[]) => ({ next: { revalidate: 60, tags } });
const live = { cache: "no-store" } as const;
const sessionHeader = (sid: string) => ({ "X-Session-Id": sid });

export type ProductQuery = NonNullable<paths["/products"]["get"]["parameters"]["query"]>;
export const productTag = (sku: string) => `product:${sku}`;

// --- Catalogue
export const getCategories = () => call<T.Category[]>(api.GET("/categories", catalog()));
export const listProducts = (query: ProductQuery) =>
  call<T.Page<T.ProductSummary>>(api.GET("/products", { params: { query }, ...catalog() }));
export const getProduct = (sku: string) =>
  call<T.Product>(api.GET("/products/{sku}", { params: { path: { sku } }, ...catalog(productTag(sku)) }));
export const listReviews = (sku: string, limit = 10, skip = 0) =>
  call<T.Page<T.Review>>(
    api.GET("/products/{sku}/reviews", { params: { path: { sku }, query: { limit, skip } }, ...catalog(productTag(sku)) }),
  );
export const createReview = (
  sku: string,
  body: { customer_id: string; author: string; rating: number; title: string; comment: string },
) => call<T.Review>(api.POST("/products/{sku}/reviews", { params: { path: { sku } }, body }));
export const getRecommendations = (sku: string, kind: T.RecoKind) =>
  call<T.Recommendation[]>(api.GET(`/recommendations/{sku}/${kind}`, { params: { path: { sku } }, ...catalog() }));

// --- Sessions et panier (en-tête X-Session-Id)
export const createSession = () => call<T.Session>(api.POST("/sessions", live));
export const getSession = (sid: string) => call<T.Session>(api.GET("/sessions/{sid}", { params: { path: { sid } }, ...live }));
export const login = (sid: string, customer_id: string) =>
  call<T.Session & { cart: T.Cart }>(api.POST("/sessions/{sid}/login", { params: { path: { sid } }, body: { customer_id } }));
export const getCart = (sid: string) => call<T.Cart>(api.GET("/cart", { headers: sessionHeader(sid), ...live }));
export const addCartItem = (sid: string, sku: string, quantity: number) =>
  call<T.Cart>(api.POST("/cart/items", { headers: sessionHeader(sid), body: { sku, quantity } }));
export const setCartItem = (sid: string, sku: string, quantity: number) =>
  call<T.Cart>(api.PUT("/cart/items/{sku}", { params: { path: { sku } }, headers: sessionHeader(sid), body: { quantity } }));
export const removeCartItem = (sid: string, sku: string) =>
  call<T.Cart>(api.DELETE("/cart/items/{sku}", { params: { path: { sku } }, headers: sessionHeader(sid) }));
export const checkout = (sid: string) => call<T.Order>(api.POST("/cart/checkout", { headers: sessionHeader(sid) }));

// --- Événements, analytics, commandes
export const postEvent = (body: paths["/events"]["post"]["requestBody"]["content"]["application/json"]) =>
  call<{ event_id: string }>(api.POST("/events", { body }));
export const getTopProducts = (period: "day" | "week", limit = 10) =>
  call<T.TopProducts>(api.GET("/analytics/top-products", { params: { query: { period, limit } }, ...live }));
export const getTopSearches = (limit = 10) =>
  call<T.TopSearch[]>(api.GET("/analytics/top-searches", { params: { query: { limit } }, ...live }));
export const getDailyViews = (sku: string, days = 7) =>
  call<T.DailyViews>(api.GET("/analytics/products/{sku}/views/daily", { params: { path: { sku }, query: { days } }, ...live }));
export const getOrder = (order_id: string) =>
  call<T.Order>(api.GET("/orders/{order_id}", { params: { path: { order_id } }, ...live }));
export const getCustomerOrders = (customer_id: string) =>
  call<T.Order[]>(api.GET("/customers/{customer_id}/orders", { params: { path: { customer_id } }, ...live }));
