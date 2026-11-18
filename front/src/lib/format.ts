const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Prix API (Decimal sérialisé en nombre ou en chaîne) → « 1 299,90 € ». */
export const formatPrice = (v: number | string) => eur.format(Number(v));
export const formatDate = (iso: string) => day.format(new Date(iso));

/** Lien qui conserve les paramètres courants en remplaçant ceux de `patch` (undefined = retiré). */
export function withParams(path: string, current: Record<string, string | string[] | undefined>, patch: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) for (const x of [v ?? []].flat()) if (x) sp.append(k, x);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export const ORDER_STATUS: Record<string, string> = { paid: "Payée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };
