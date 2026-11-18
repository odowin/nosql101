"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import type { z } from "zod";
import * as api from "@/lib/api/client";
import type { Cart, Order, Review } from "@/lib/api/types";
import {
  addItemSchema,
  eventSchema,
  firstIssue,
  loginSchema,
  reviewSchema,
  setQuantitySchema,
  skuSchema,
} from "@/lib/schemas";
import { endSession, getSessionId, withSession } from "@/lib/session";

// Résultat sérialisable : en production Next masque le message des erreurs levées par une action.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return attempt(() => fn(parsed.data));
}

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof api.ApiError) return { ok: false, error: e.message };
    throw e;
  }
}

// Après une mutation du panier, refresh() re-rend les Server Components (compteur de l'en-tête).
const andRefresh = <T>(value: T) => (refresh(), value);

export async function addToCart(input: { sku: string; quantity: number }): Promise<ActionResult<Cart>> {
  return run(addItemSchema, input, ({ sku, quantity }) =>
    withSession((sid) => api.addCartItem(sid, sku, quantity)).then(andRefresh),
  );
}

export async function setCartQuantity(input: { sku: string; quantity: number }): Promise<ActionResult<Cart>> {
  return run(setQuantitySchema, input, ({ sku, quantity }) =>
    withSession((sid) => api.setCartItem(sid, sku, quantity)).then(andRefresh),
  );
}

export async function removeFromCart(input: { sku: string }): Promise<ActionResult<Cart>> {
  return run(skuSchema, input, ({ sku }) => withSession((sid) => api.removeCartItem(sid, sku)).then(andRefresh));
}

export async function loginCustomer(input: { customer_id: string }): Promise<ActionResult<Cart>> {
  return run(loginSchema, input, ({ customer_id }) =>
    withSession((sid) => api.login(sid, customer_id)).then((s) => andRefresh(s.cart)),
  );
}

/** Le panier client reste dans Redis (TTL propre) et revient à la reconnexion. */
export async function logout(): Promise<void> {
  await endSession();
  refresh();
}

export async function checkout(): Promise<ActionResult<Order>> {
  return attempt(() => withSession(api.checkout).then(andRefresh));
}

export async function addReview(input: {
  sku: string;
  author: string;
  rating: number | string;
  title: string;
  comment: string;
}): Promise<ActionResult<Review>> {
  return run(reviewSchema, input, async ({ sku, ...review }) => {
    const { customer_id } = await withSession(api.getSession);
    if (!customer_id) throw new api.ApiError(403, "Connectez-vous pour publier un avis");
    const created = await api.createReview(sku, { customer_id, ...review });
    updateTag(api.productTag(sku));
    return created;
  });
}

/** Vue produit ou recherche : envoyé après la réponse, sans bloquer ni échouer côté interface. */
export async function trackEvent(
  input: { event_type: "product_view"; sku: string } | { event_type: "search"; search_query: string },
): Promise<void> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return;
  const session_id = await getSessionId();
  after(() => api.postEvent({ ...parsed.data, session_id }).catch(() => {}));
}
