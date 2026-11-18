"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Ellipsis, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import type { Category } from "@/lib/api/types";
import { categoryHref } from "@/lib/categories";

export type NavLink = { href: string; label: string };

/** Ferme le menu dès qu'on suit un lien qu'il contient (la navigation client ne le fait pas d'elle-même). */
const closeOnLink = (close: () => void) => (e: React.MouseEvent) => {
  if ((e.target as Element).closest("a")) close();
};

/**
 * Délai d'intention au survol : ouvre après 150 ms, ferme 250 ms après la sortie (le pointeur peut traverser un vide).
 * Souris seulement : au doigt, c'est le clic qui ouvre.
 */
export function useHoverIntent(setOpen: (open: boolean) => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const later = (e: React.PointerEvent, open: boolean, ms: number) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(open), ms);
  };
  return {
    onPointerEnter: (e: React.PointerEvent) => later(e, true, 150),
    onPointerLeave: (e: React.PointerEvent) => later(e, false, 250),
  };
}

/**
 * Méga-menu desktop : colonne de niveau 1 (200 px, vignette + chevron) et panneau bleu pâle en colonnes de 175 px
 * (titres de groupe de niveau 2, liens de niveau 3, « Voir + »). Placé sous l'en-tête, grandit depuis le coin du déclencheur.
 */
export function MegaMenu({
  id,
  categories,
  onClose,
  hover,
}: {
  id: string;
  categories: Category[];
  onClose: () => void;
  hover: ReturnType<typeof useHoverIntent>;
}) {
  const [activeId, setActiveId] = useState(categories[0]?._id);
  const active = categories.find((c) => c._id === activeId);
  // Petit délai au survol d'une entrée : une diagonale vers le panneau ne change pas d'univers au passage.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const activate = (cid: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActiveId(cid), 100);
  };

  return (
    <div
      id={id}
      {...hover}
      onClick={closeOnLink(onClose)}
      className="absolute top-full left-0 z-50 flex origin-top-left text-ldlc-strong animate-in fade-in zoom-in-95 duration-150"
    >
      {categories.length === 0 ? (
        <p className="w-[300px] bg-white p-4 shadow-[2px_2px_4px_oklch(0_0_0/40%)]">
          Catégories indisponibles.{" "}
          <Link href="/produits" className="font-bold text-link underline underline-offset-4">
            Voir tout le catalogue
          </Link>
        </p>
      ) : (
        <>
          <ul className="w-[200px] self-start bg-white shadow-[2px_2px_4px_oklch(0_0_0/40%)]">
            {categories.map((c) => (
              <li key={c._id} className="border-b border-border last:border-0">
                <Link
                  href={categoryHref(c)}
                  aria-current={c._id === activeId ? "true" : undefined}
                  onPointerEnter={() => activate(c._id)}
                  onFocus={() => setActiveId(c._id)}
                  className="flex h-[52px] items-center gap-2 pr-2 text-[0.8125rem] font-medium transition-colors hover:bg-ldlc-pale hover:text-primary aria-[current]:bg-ldlc-pale aria-[current]:text-primary"
                >
                  <span className="flex size-[50px] shrink-0 items-center justify-center">
                    <CategoryIcon id={c._id} className="size-7" />
                  </span>
                  <span className="flex-1">{c.name}</span>
                  {c.children.length > 0 && <ChevronRight className="size-4" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
          {active && active.children.length > 0 && (
            <div
              aria-label={`Rayons ${active.name}`}
              role="group"
              className="w-[min(853px,calc(100vw-200px))] bg-ldlc-pale py-2 shadow-[2px_2px_4px_oklch(0_0_0/50%)] [column-rule:1px_solid_white] [columns:175px_5] [column-gap:0]"
            >
              {active.children.map((g) => (
                <section key={g._id} className="break-inside-avoid px-3.5 pt-2 pb-3">
                  <h3 className="text-sm font-bold text-ldlc-navy">
                    <Link href={categoryHref(g)} className="flex min-h-8 items-center hover:underline underline-offset-4">
                      {g.name}
                    </Link>
                  </h3>
                  {g.children.length > 0 && (
                    <ul>
                      {g.children.map((s) => (
                        <li key={s._id}>
                          <Link href={categoryHref(s)} className="flex min-h-8 items-center py-[5px] text-[0.8125rem] font-medium text-ldlc-text hover:text-primary hover:underline underline-offset-4">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={categoryHref(g)} className="flex min-h-8 items-center text-[0.8125rem] font-bold text-ldlc-navy hover:underline underline-offset-4">
                    Voir +<span className="sr-only"> {g.name}</span>
                  </Link>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Tiroir mobile (et burger) : 300 px depuis la gauche, fond bleu, descente niveau par niveau avec « Retour ».
 * <dialog> modal : focus piégé, Échap et fond inerte fournis par le navigateur.
 */
export function MenuDrawer({
  open,
  onClose,
  categories,
  links,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  links: NavLink[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState<Category[]>([]);
  const node = path.at(-1);

  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  const go = (next: Category[]) => {
    setPath(next);
    // Après le changement de niveau, le focus passe au premier élément du nouveau niveau.
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[data-level] :is(a, button)")?.focus());
  };
  const row = "flex h-[51px] w-full items-center gap-3 border-b border-white/25 px-[15px] text-base text-white transition-colors hover:bg-white/10 focus-visible:outline-white focus-visible:-outline-offset-2 active:bg-white/15";

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClose={() => {
        setPath([]);
        onClose();
      }}
      // Clic sur le voile (hors du tiroir) : ferme.
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
        else closeOnLink(() => ref.current?.close())(e);
      }}
      className="drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[300px] max-w-[85vw] overflow-y-auto bg-primary p-0 pb-[env(safe-area-inset-bottom)] text-white"
    >
      <div className="flex h-[54px] items-center border-b border-white/25 bg-header pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fermer le menu" className="flex size-[54px] items-center justify-center hover:bg-white/10">
          <X className="size-7" strokeWidth={1.5} aria-hidden />
        </button>
        <span className="caps text-[0.8125rem] font-bold">{node ? node.name : "Menu"}</span>
      </div>
      <div data-level key={node?._id ?? "root"} className="animate-in fade-in slide-in-from-right-4 duration-200">
        {node && (
          <button type="button" onClick={() => go(path.slice(0, -1))} className={`${row} caps bg-ldlc-text text-[0.8125rem] font-bold`}>
            <ChevronLeft className="size-4" aria-hidden />
            Retour
          </button>
        )}
        <ul>
          {(node ? node.children : categories).map((c) => (
            <li key={c._id}>
              {c.children.length > 0 ? (
                <button type="button" onClick={() => go([...path, c])} className={`${row} justify-between text-left`}>
                  {c.name}
                  <Ellipsis className="size-6 opacity-80" aria-hidden />
                  <span className="sr-only">, voir les sous-catégories</span>
                </button>
              ) : (
                <Link href={categoryHref(c)} className={row}>
                  {c.name}
                </Link>
              )}
            </li>
          ))}
          {node && (
            <li>
              <Link href={categoryHref(node)} className={`${row} font-bold`}>
                Voir +<span className="sr-only"> {node.name}</span>
              </Link>
            </li>
          )}
          {!node &&
            links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`${row} caps text-sm font-semibold`}>
                  {l.label}
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </dialog>
  );
}
