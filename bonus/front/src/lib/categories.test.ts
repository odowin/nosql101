import { describe, expect, it } from "vitest";
import type { Category } from "./api/types";
import { categoryHref, categoryTrail } from "./categories";

const node = (id: string, children: Category[] = [], parent: string | null = null): Category => ({ _id: id, name: id, parent, children });
const tree = [node("informatique", [node("composants", [node("cpu"), node("gpu")]), node("logiciels", [node("os")])])];

describe("categoryTrail", () => {
  it("renvoie le chemin depuis la racine, vide si la catégorie est inconnue", () => {
    expect(categoryTrail(tree, "gpu").map((c) => c._id)).toEqual(["informatique", "composants", "gpu"]);
    expect(categoryTrail(tree, "informatique").map((c) => c._id)).toEqual(["informatique"]);
    expect(categoryTrail(tree, "nope")).toEqual([]);
  });
});

describe("categoryHref", () => {
  it("mène à la page univers pour un parent, à la liste filtrée pour une feuille", () => {
    expect(categoryHref(tree[0].children[0])).toBe("/categories/composants");
    expect(categoryHref(node("cpu"))).toBe("/produits?category=cpu");
  });
});
