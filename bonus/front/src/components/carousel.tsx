"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Carrousel horizontal : défilement natif (doigt, molette, Tab sur les liens) avec accroche, flèches ‹ › dès 1024 px.
 * Les flèches avancent d'une largeur visible et se désactivent aux extrémités.
 */
export function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // Aussi quand l'onglet qui contient le carrousel s'affiche (largeur 0 tant qu'il est masqué).
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
  };

  // Rien à faire défiler : flèches masquées, place gardée.
  const arrows = `text-primary max-lg:hidden ${edge.start && edge.end ? "invisible" : ""}`;
  return (
    <div role="region" aria-roledescription="carrousel" aria-label={label} className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Produits précédents" disabled={edge.start} onClick={() => go(-1)} className={arrows}>
        <ChevronLeft className="size-7" aria-hidden />
      </Button>
      <ul ref={ref} className="flex flex-1 snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:thin]">
        {children}
      </ul>
      <Button variant="ghost" size="icon" aria-label="Produits suivants" disabled={edge.end} onClick={() => go(1)} className={arrows}>
        <ChevronRight className="size-7" aria-hidden />
      </Button>
    </div>
  );
}
