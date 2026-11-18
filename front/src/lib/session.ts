import "server-only";
import { cookies } from "next/headers";
import { ApiError, createSession } from "./api/client";

const COOKIE = "sid";

/** Lecture seule, utilisable dans un Server Component (qui ne peut pas écrire de cookie). */
export async function readSessionId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

/** Crée une session API et pose le cookie. Server Action ou route handler uniquement. */
async function newSessionId(): Promise<string> {
  const { session_id } = await createSession();
  (await cookies()).set(COOKIE, session_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400, // la session API expire avant (TTL glissant 30 min) : withSession la recrée
  });
  return session_id;
}

/** Lit le cookie ou crée la session. Server Action ou route handler uniquement. */
export async function getSessionId(): Promise<string> {
  return (await readSessionId()) ?? newSessionId();
}

/** L'API répond 401 (routes /cart) ou 404 « Session introuvable » (routes /sessions/{sid}). */
export function isSessionExpired(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || (e.status === 404 && e.message === "Session introuvable"));
}

/** Exécute `fn` avec l'id de session ; si l'API la dit expirée, en recrée une et réessaie une fois. */
export async function withSession<R>(fn: (sid: string) => Promise<R>): Promise<R> {
  try {
    return await fn(await getSessionId());
  } catch (e) {
    if (!isSessionExpired(e)) throw e;
    return fn(await newSessionId());
  }
}
