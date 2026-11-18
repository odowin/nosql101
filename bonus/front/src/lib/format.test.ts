import { describe, expect, it } from "vitest";
import { formatPrice, priceView, withParams } from "./format";

describe("format", () => {
  it("formate un prix en euros fr-FR, qu'il arrive en nombre ou en chaîne", () => {
    // Intl utilise des espaces insécables : on les normalise pour comparer.
    expect(formatPrice(1299.9).replace(/\s/g, " ")).toBe("1 299,90 €");
    expect(formatPrice("12.5").replace(/\s/g, " ")).toBe("12,50 €");
  });

  it("garde les paramètres répétés, remplace ceux du patch et retire les vides", () => {
    expect(withParams("/produits", { q: "ssd", spec: ["a:1", "b:2"], page: "3" }, { page: undefined })).toBe(
      "/produits?q=ssd&spec=a%3A1&spec=b%3A2",
    );
    expect(withParams("/produits", { page: "2" }, { page: "" })).toBe("/produits");
  });
});

describe("priceView", () => {
  const base = { price: 489.95, effective_price: 489.95, on_sale: false, discount_percent: null, promo: null };
  const promo = { label: "Black Friday", percent: 15, starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-12-01T23:00:00Z" };
  const norm = (s?: string) => s?.replace(/\s/g, " ");

  it("sans promo : seulement le prix de référence", () => {
    expect(norm(priceView(base).now)).toBe("489,95 €");
    expect(priceView(base).was).toBeUndefined();
  });

  it("promo à venir ou expirée (on_sale false) : rien de barré même si promo est présente", () => {
    expect(Object.keys(priceView({ ...base, promo }))).toEqual(["now"]);
  });

  it("promo en cours : prix effectif, prix barré, badge −X % et date de fin", () => {
    const v = priceView({ ...base, effective_price: 416.46, on_sale: true, discount_percent: 15, promo });
    expect(norm(v.now)).toBe("416,46 €");
    expect(norm(v.was)).toBe("489,95 €");
    expect(norm(v.badge)).toBe("−15 %");
    expect(v.label).toBe("Black Friday");
    // ends_at 2 déc. 00:00 à Paris, exclusif → jusqu'au 1 déc.
    expect(v.until).toBe("jusqu'au 1 déc.");
  });
});
