import type { DailyViews } from "./api/types";

/** Série complète des `days` derniers jours (UTC, du plus ancien au plus récent) : l'API omet les jours sans vue. */
export function fillDays(rows: DailyViews, days: number, today = new Date()) {
  const byDay = new Map(rows.map((r) => [r.day, r.views]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)));
    const day = d.toISOString().slice(0, 10);
    return { day, views: byDay.get(day) ?? 0 };
  });
}
