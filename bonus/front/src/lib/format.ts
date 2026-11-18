import type { PriceInfo } from "./api/types";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Prix API (Decimal sérialisé en nombre ou en chaîne) → « 1 299,90 € ». */
export const formatPrice = (v: number | string) => eur.format(Number(v));
export const formatDate = (iso: string) => day.format(new Date(iso));
// Fuseau fixé : le rendu serveur (UTC dans Docker) et les tests donnent la même date.
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Ce qu'affiche le composant Price ; `was`, `badge`, `until` sont absents hors promo en cours. */
export function priceView(p: PriceInfo) {
  if (!p.on_sale || p.effective_price >= p.price) return { now: formatPrice(p.price) };
  return {
    now: formatPrice(p.effective_price),
    was: formatPrice(p.price),
    badge: p.discount_percent ? `\u2212${p.discount_percent}\u00a0%` : undefined,
    label: p.promo?.label,
    // ends_at est exclusif : la promo vaut jusqu'à l'instant précédent.
    until: p.promo ? `jusqu'au ${dayMonth.format(new Date(Date.parse(p.promo.ends_at) - 1))}` : undefined,
  };
}

/** TTL Redis en secondes → « 29 min 05 s » ; négatif (-1 sans TTL, -2 clé absente) → « expirée ». */
export function formatTtl(seconds: number) {
  if (seconds < 0) return "expirée";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return m ? `${m} min ${s} s` : `${seconds} s`;
}

/** Lien qui conserve les paramètres courants en remplaçant ceux de `patch` (undefined = retiré). */
export function withParams(path: string, current: Record<string, string | string[] | undefined>, patch: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) for (const x of [v ?? []].flat()) if (x) sp.append(k, x);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export const ORDER_STATUS: Record<string, string> = { paid: "Payée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };
