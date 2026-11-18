import { describe, expect, it } from "vitest";
import { eventSchema, firstIssue, loginSchema, reviewSchema } from "./schemas";

const review = { sku: "CPU-1", author: " Lucas ", rating: "4", title: "Très bien", comment: "Rapide et silencieux." };

describe("schémas zod", () => {
  it("avis : coerce la note venue d'un formulaire et nettoie les espaces", () => {
    expect(reviewSchema.parse(review)).toMatchObject({ author: "Lucas", rating: 4 });
  });

  it("avis : refuse une note hors 1..5 avec un message lisible", () => {
    const r = reviewSchema.safeParse({ ...review, rating: 6 });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssue(r.error)).toBe("Note entre 1 et 5");
  });

  it("connexion : normalise l'identifiant et refuse un format inconnu", () => {
    expect(loginSchema.parse({ customer_id: " c0001 " }).customer_id).toBe("C0001");
    expect(loginSchema.safeParse({ customer_id: "bob" }).success).toBe(false);
  });

  it("événement : sku requis pour product_view, search_query pour search", () => {
    expect(eventSchema.safeParse({ event_type: "product_view" }).success).toBe(false);
    expect(eventSchema.safeParse({ event_type: "search", search_query: "ryzen" }).success).toBe(true);
    expect(eventSchema.safeParse({ event_type: "click", sku: "X" }).success).toBe(false);
  });
});
