import { afterEach, describe, expect, it, vi } from "vitest";
import { listProducts } from "./api/client";
import { pageList, parseCatalogFilters } from "./catalog-filters";

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

  it("valide le tri, lit en stock et garde plusieurs marques", () => {
    expect(parseCatalogFilters({ sort: "price_desc", in_stock: "true", brand: ["amd", " intel ", ""] })).toMatchObject({
      sort: "price_desc",
      in_stock: true,
      brand: ["amd", "intel"],
    });
    expect(parseCatalogFilters({ sort: "nope" }).sort).toBeUndefined();
    expect(parseCatalogFilters({ sort: "" }).sort).toBeUndefined();
  });

  it("envoie tri, marques répétées et en stock à GET /products", async () => {
    const fetchMock = vi.fn<(req: Request) => Promise<Response>>(async () => Response.json({ total: 0, items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await listProducts(parseCatalogFilters({ brand: ["amd", "intel"], in_stock: "true", sort: "rating" }));
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.searchParams.getAll("brand")).toEqual(["amd", "intel"]);
    expect(url.searchParams.get("in_stock")).toBe("true");
    expect(url.searchParams.get("sort")).toBe("rating");
  });
});

describe("pageList", () => {
  it("liste tout jusqu'à 7 pages, sinon resserre autour de la page courante", () => {
    expect(pageList(1, 3)).toEqual([1, 2, 3]);
    expect(pageList(1, 10)).toEqual([1, 2, "…", 10]);
    expect(pageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(pageList(10, 10)).toEqual([1, "…", 9, 10]);
    expect(pageList(3, 10)).toEqual([1, 2, 3, 4, "…", 10]);
  });
});
