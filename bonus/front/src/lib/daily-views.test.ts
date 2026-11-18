import { describe, expect, it } from "vitest";
import { fillDays } from "./daily-views";

describe("fillDays", () => {
  it("complète les jours manquants à 0 et remet la série dans l'ordre chronologique", () => {
    const rows = [
      { day: "2026-03-01", views: 5 },
      { day: "2026-02-27", views: 2 },
    ];
    expect(fillDays(rows, 4, new Date("2026-03-01T23:30:00Z"))).toEqual([
      { day: "2026-02-26", views: 0 },
      { day: "2026-02-27", views: 2 },
      { day: "2026-02-28", views: 0 },
      { day: "2026-03-01", views: 5 },
    ]);
  });
});
