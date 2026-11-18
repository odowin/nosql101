import { describe, expect, it } from "vitest";
import { cn, safeReturn } from "./utils";

describe("cn", () => {
  it("fusionne les classes Tailwind en conflit et ignore les valeurs fausses", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});

describe("safeReturn", () => {
  it("garde un chemin interne et refuse les URL externes", () => {
    expect(safeReturn("/panier")).toBe("/panier");
    expect(safeReturn("/commandes?x=1")).toBe("/commandes?x=1");
    for (const bad of ["//evil.test", "/\\evil.test", "https://evil.test", "", undefined, ["/a"]]) expect(safeReturn(bad)).toBe("/compte");
  });
});
