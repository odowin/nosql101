"use client";

import { useState } from "react";

/**
 * Curseur double du filtre prix : deux `input[type=range]` natifs superposés (clavier et lecteurs d'écran inclus).
 * Un curseur resté en butée n'envoie rien, pour ne pas filtrer inutilement.
 */
export function PriceRange({ min, max, from, to }: { min: number; max: number; from: number; to: number }) {
  const [lo, setLo] = useState(from);
  const [hi, setHi] = useState(to);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const common = { min, max, step: 1, className: "dual-range absolute inset-0 h-full w-full" } as const;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-11 rounded-lg bg-white shadow-[0_0_0_1px_var(--border)]">
        <span aria-hidden className="absolute inset-y-[19px] rounded bg-ldlc-price/30" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" {...common} name={lo > min ? "min_price" : undefined} value={lo} aria-label="Prix minimum" aria-valuetext={`${lo} €`}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi))} />
        <input type="range" {...common} name={hi < max ? "max_price" : undefined} value={hi} aria-label="Prix maximum" aria-valuetext={`${hi} €`}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo))} />
      </div>
      <div aria-hidden className="tabular flex justify-between text-sm font-bold">
        <span className="rounded-md bg-ldlc-price px-2 py-0.5 text-white">{lo} €</span>
        <span className="rounded-md bg-ldlc-price px-2 py-0.5 text-white">{hi} €</span>
      </div>
    </div>
  );
}
