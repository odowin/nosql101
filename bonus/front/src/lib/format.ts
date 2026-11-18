import type { PriceInfo, Spec } from "./api/types";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Prix API (Decimal sérialisé en nombre ou en chaîne) → « 1 299,90 € ». */
export const formatPrice = (v: number | string) => eur.format(Number(v));
/** Prix LDLC « 1 299€<sup>90</sup> » : partie entière (séparateur de milliers compris) et centimes. */
export function priceParts(v: number | string) {
  const parts = eur.formatToParts(Number(v));
  const pick = (...types: string[]) => parts.filter((x) => types.includes(x.type)).map((x) => x.value).join("");
  return { units: pick("minusSign", "integer", "group"), cents: pick("fraction") };
}

const num = new Intl.NumberFormat("fr-FR");

/** Description courte d'un produit depuis ses specs : « Socket AM5 - Cœurs 8 - Fréquence de base 4,7 GHz ». Un booléen faux est omis. */
export const specSummary = (specs: Spec[], max = 6) =>
  specs
    .filter((s) => s.v !== false)
    .slice(0, max)
    .map((s) => {
      const label = s.label ?? s.k;
      if (s.v === true) return label;
      return `${label} ${typeof s.v === "number" ? num.format(s.v) : s.v}${s.u ? ` ${s.u}` : ""}`;
    })
    .join(" - ");

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

/** Période d'une promo [starts_at, ends_at) → « du 6 nov. au 19 nov. » (ends_at exclusif). */
export const formatPeriod = (p: { starts_at: string; ends_at: string }) =>
  `du ${dayMonth.format(new Date(p.starts_at))} au ${dayMonth.format(new Date(Date.parse(p.ends_at) - 1))}`;

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

/** Répartition des notes 5 → 1 étoile : nombre d'avis et pourcentage arrondi (0 sans avis). */
export function ratingBreakdown(ratings: number[]) {
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.filter((r) => r === stars).length;
    return { stars, count, pct: ratings.length ? Math.round((count / ratings.length) * 100) : 0 };
  });
}
