import { afterEach, describe, expect, it, vi } from "vitest";
import { listProducts } from "./api/client";
import { parseCatalogFilters } from "./catalog-filters";

afterEach(() => vi.unstubAllGlobals());

describe("parseCatalogFilters", () => {
  it("garde les specs k:v valides, ignore les autres, et convertit page en skip", () => {
    expect(
      parseCatalogFilters({ category: "cpu", spec: ["socket:AM5", "sans-separateur", " cores:8 ", ":x"], page: "3" }),
    ).toMatchObject({ category: "cpu", spec: ["socket:AM5", "cores:8"], limit: 20, skip: 40, on_sale: undefined });
    expect(parseCatalogFilters({ on_sale: "true" }).on_sale).toBe(true);
  });

  it("accepte une spec unique, des prix à virgule et rejette prix négatif ou page invalide", () => {
    expect(parseCatalogFilters({ spec: "socket:AM5", min_price: "99,5", max_price: "-1", page: "abc" })).toMatchObject({
      spec: ["socket:AM5"],
      min_price: 99.5,
      max_price: undefined,
      skip: 0,
    });
  });

  it("produit la query string attendue par GET /products (spec répétée, champs vides omis)", async () => {
    const fetchMock = vi.fn<(req: Request) => Promise<Response>>(async () => Response.json({ total: 0, items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await listProducts(parseCatalogFilters({ category: "cpu", q: " ", spec: ["socket:AM5", "cores:8"], page: "2" }));
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.pathname).toBe("/products");
    expect([...url.searchParams]).toEqual([
      ["category", "cpu"],
      ["spec", "socket:AM5"],
      ["spec", "cores:8"],
      ["limit", "20"],
      ["skip", "20"],
    ]);
  });
});
