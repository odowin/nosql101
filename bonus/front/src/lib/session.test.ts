import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api/client";
import { endSession, isSessionExpired, withSession } from "./session";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

afterEach(() => {
  jar.clear();
  vi.unstubAllGlobals();
});

describe("session", () => {
  it("distingue session expirée et SKU inconnu", () => {
    expect(isSessionExpired(new ApiError(401, "Session absente ou expirée"))).toBe(true);
    expect(isSessionExpired(new ApiError(404, "Session introuvable"))).toBe(true);
    expect(isSessionExpired(new ApiError(404, "SKU inconnu"))).toBe(false);
  });

  it("recrée la session une fois si l'API la dit expirée, et met le cookie à jour", async () => {
    jar.set("sid", "old");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ session_id: "new", cart_id: "anon:x", ttl: 1800 }, { status: 201 })));
    const fn = vi.fn(async (sid: string) => {
      if (sid === "old") throw new ApiError(401, "Session absente ou expirée");
      return sid;
    });
    await expect(withSession(fn)).resolves.toBe("new");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(jar.get("sid")).toBe("new");
  });

  it("ne réessaie pas sur une autre erreur", async () => {
    jar.set("sid", "ok");
    const fn = vi.fn().mockRejectedValue(new ApiError(404, "SKU inconnu"));
    await expect(withSession(fn)).rejects.toMatchObject({ message: "SKU inconnu" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("déconnexion : DELETE /sessions/{sid} puis cookie supprimé", async () => {
    jar.set("sid", "abc");
    const fetchMock = vi.fn<(req: Request) => Promise<Response>>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await endSession();
    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe("DELETE");
    expect(new URL(req.url).pathname).toBe("/sessions/abc");
    expect(jar.has("sid")).toBe(false);
  });

  it("déconnexion : supprime le cookie même si l'API est injoignable", async () => {
    jar.set("sid", "abc");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await endSession();
    expect(jar.has("sid")).toBe(false);
  });
});
