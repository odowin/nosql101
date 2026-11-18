import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, addCartItem, getProduct, getCart } from "./client";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal("fetch", vi.fn<(req: Request) => Promise<Response>>(async () => Response.json(body, { status })));

describe("client API", () => {
  it("lève ApiError avec le statut et le detail FastAPI", async () => {
    respond({ detail: "produit inconnu" }, 404);
    await expect(getProduct("X")).rejects.toEqual(new ApiError(404, "produit inconnu"));
    await expect(getProduct("X")).rejects.toMatchObject({ status: 404 });
  });

  it("aplatit les erreurs de validation 422", async () => {
    respond({ detail: [{ msg: "quantity trop petite" }, { msg: "sku requis" }] }, 422);
    await expect(addCartItem("s", "", 0)).rejects.toMatchObject({
      status: 422,
      message: "quantity trop petite ; sku requis",
    });
  });

  it("transforme une panne réseau en ApiError 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(getCart("s")).rejects.toMatchObject({ status: 503, message: "API injoignable" });
  });

  it("envoie X-Session-Id et le corps JSON, et renvoie les données", async () => {
    const cart = { cart_id: "anon:1", items: [], total: 0, ttl: 1 };
    const fetchMock = vi.fn<(req: Request) => Promise<Response>>(async () => Response.json(cart));
    vi.stubGlobal("fetch", fetchMock);
    await expect(addCartItem("abc", "CPU-1", 2)).resolves.toEqual(cart);
    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe("POST");
    expect(req.headers.get("X-Session-Id")).toBe("abc");
    expect(await req.json()).toEqual({ sku: "CPU-1", quantity: 2 });
  });
});
