"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type Tab = { id: string; title: string; content: React.ReactNode };

/**
 * Onglets LDLC dès 1024 px (tablist ARIA, flèches / Début / Fin) ; en dessous, accordéons (bouton aria-expanded).
 * Chaque panneau n'est rendu qu'une fois : sa visibilité suit l'onglet actif en desktop et l'ouverture en mobile.
 */
export function ProductTabs({ tabs, initial, label }: { tabs: Tab[]; initial?: string; label: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const [open, setOpen] = useState(() => new Set(initial ? [initial] : []));
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Lien #id (ex. « N avis » ou pagination des avis) : active l'onglet visé.
  useEffect(() => {
    const sync = () => {
      const id = location.hash.slice(1);
      if (!tabs.some((t) => t.id === id)) return;
      setActive(id);
      setOpen((s) => new Set(s).add(id));
    };
    sync();
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, [tabs]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const id = tabs[to % n].id;
    setActive(id);
    refs.current[id]?.focus();
  };

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex overflow-x-auto rounded-t-lg bg-border max-lg:hidden">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => void (refs.current[t.id] = el)}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className="caps min-h-11 shrink-0 border-t-[3px] border-r border-t-border border-r-[oklch(85%_0_0)] px-[22px] pt-[7px] pb-[6px] text-[15px] font-medium tracking-normal text-ldlc-text transition-colors hover:bg-white/60 aria-selected:border-t-ldlc-blue aria-selected:bg-white aria-selected:font-semibold aria-selected:text-primary"
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 lg:gap-0">
        {tabs.map((t) => (
          <section key={t.id} id={t.id} className="scroll-mt-24 rounded-lg border border-border bg-card lg:rounded-t-none lg:border-0">
            <h2 className="lg:hidden">
              <button
                type="button"
                aria-expanded={open.has(t.id)}
                aria-controls={`panel-${t.id}`}
                onClick={() => toggle(t.id)}
                className="caps flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left text-[13px] font-bold tracking-normal text-ldlc-strong"
              >
                {t.title}
                <ChevronDown className={`size-5 text-primary transition-transform ${open.has(t.id) ? "rotate-180" : ""}`} aria-hidden />
              </button>
            </h2>
            <div
              id={`panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${t.id}`}
              className={`px-4 pb-5 lg:px-[30px] lg:pt-[22px] ${open.has(t.id) ? "" : "max-lg:hidden"} ${active === t.id ? "" : "lg:hidden"}`}
            >
              {t.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
