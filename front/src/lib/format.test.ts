import { describe, expect, it } from "vitest";
import { formatPrice, withParams } from "./format";

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
