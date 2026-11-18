"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Slide = { id: string; tab: string; content: React.ReactNode };

/**
 * Hero de l'accueil (SPEC §3) : une slide et, dès 1024 px, la barre d'onglets qui la pilote (actif noir, flèche ▲ vers la slide).
 * Sous 1024 px, les onglets laissent place à des points. Pas de défilement automatique : on change de slide au clic ou au clavier.
 */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = slides.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  return (
    <section aria-roledescription="carrousel" aria-label="À la une" className="overflow-hidden rounded-lg">
      {slides.map((s, i) => (
        <div
          key={s.id}
          id={`slide-${s.id}`}
          role="tabpanel"
          aria-labelledby={`hero-tab-${s.id}`}
          hidden={i !== active}
          className="animate-in fade-in duration-300"
        >
          {s.content}
        </div>
      ))}

      <div role="tablist" aria-label="Choisir la slide" className="grid bg-white max-lg:hidden" style={{ gridTemplateColumns: `repeat(${slides.length}, 1fr)` }}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => void (tabs.current[i] = el)}
            id={`hero-tab-${s.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`slide-${s.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "caps relative min-h-11 border-l border-[oklch(88%_0_0)] px-3 text-[13px] font-medium tracking-normal transition-colors first:border-l-0",
              i === active
                ? "bg-black text-white before:absolute before:-top-1.5 before:left-1/2 before:-translate-x-1/2 before:border-x-[7px] before:border-b-[7px] before:border-x-transparent before:border-b-black"
                : "text-ldlc-text hover:bg-ldlc-alt active:bg-border",
            )}
          >
            {s.tab}
          </button>
        ))}
      </div>

      {/* Mobile : points de pagination, cibles de 44 px autour d'un point de 10 px. */}
      <div className="flex justify-center lg:hidden">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.tab}
            aria-current={i === active}
            onClick={() => setActive(i)}
            className="grid size-11 place-items-center"
          >
            <span className={cn("size-2.5 rounded-full transition-colors", i === active ? "bg-ldlc-blue" : "bg-white/40")} />
          </button>
        ))}
      </div>
    </section>
  );
}
