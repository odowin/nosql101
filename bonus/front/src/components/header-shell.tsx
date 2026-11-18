"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, Menu, Package, Percent, Search, ShoppingBag, Store, ThumbsUp, User } from "lucide-react";
import { MegaMenu, MenuDrawer, useHoverIntent } from "@/components/categories-menu";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// shortcut: Swagger joint sur le port publié par docker compose ; à passer en variable si l'API change d'adresse publique.
const SWAGGER = "http://localhost:8000/docs";

const navLinks = [
  { href: "/produits?on_sale=true", label: "Promos", icon: Percent },
  { href: "/analytics", label: "Meilleures ventes", icon: ThumbsUp },
  { href: "/commandes", label: "Commandes", icon: Package },
  { href: SWAGGER, label: "Aide", icon: CircleHelp },
];

/**
 * En-tête LDLC : 80 + 40 px en desktop, [burger | logo | icônes] + recherche en mobile.
 * Une fois défilé hors de vue, il devient un en-tête compact fixe de 50 px (burger, recherche, icônes sans libellé) ;
 * l'emplacement garde sa hauteur, donc rien ne saute.
 */
export function HeaderShell({ customer, count, categories }: { customer?: string; count: number; categories: Category[] }) {
  const slot = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [mega, setMega] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const hover = useHoverIntent(setMega);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setCompact(!e.isIntersecting);
      setMega(false); // le déclencheur change (onglet ↔ burger) : on referme plutôt que de laisser un panneau orphelin
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Méga-menu ouvert : Échap le ferme et rend le focus au déclencheur visible, un clic hors de l'en-tête aussi.
  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMega(false);
      [...(header.current?.querySelectorAll<HTMLElement>("[aria-controls=mega-menu]") ?? [])].find((b) => b.offsetParent)?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setMega(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [mega]);

  // Le burger ouvre le méga-menu en desktop (en-tête compact) et le tiroir en mobile.
  const burger = () => (matchMedia("(width >= 64rem)").matches ? setMega((o) => !o) : setDrawer(true));

  const cell = compact ? "h-[50px]" : "h-[54px] lg:h-20";
  const icon = cn(
    "relative flex flex-col items-center justify-center gap-1 text-white/90 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15",
    cell,
    compact ? "w-12 lg:w-[84px]" : "w-[54px] border-l border-white/20 lg:w-[84px] lg:border-0",
  );
  const label = cn("caps text-[0.6875rem] font-medium", compact ? "sr-only" : "max-lg:sr-only");

  return (
    <div ref={slot} className="h-[110px] bg-header lg:h-[120px]">
      <header
        ref={header}
        className={cn(
          "z-40 w-full bg-header text-white shadow-[0_1px_1px_oklch(0_0_0/25%)] pt-[env(safe-area-inset-top)]",
          compact ? "fixed inset-x-0 top-0 animate-in slide-in-from-top duration-200" : "relative",
        )}
      >
        <div className="relative mx-auto flex max-w-[1600px] flex-wrap items-center pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:gap-x-4 lg:pr-[max(20px,env(safe-area-inset-right))]">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 font-black tracking-[-0.06em] max-lg:flex-1 max-lg:justify-center lg:pl-5",
              cell,
              compact ? "text-2xl lg:w-[170px]" : "text-[1.75rem] lg:w-[200px] lg:text-[2.75rem]",
            )}
          >
            LDLC
            <span className="caps rounded-full bg-white px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.06em] text-black">NoSQL</span>
          </Link>

          <button
            type="button"
            onClick={burger}
            aria-expanded={mega || drawer}
            aria-controls="mega-menu"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-white/10 active:bg-white/15 max-lg:order-first max-lg:w-[54px] max-lg:border-r max-lg:border-white/20 lg:w-16",
              cell,
              !compact && "lg:hidden",
            )}
          >
            <Menu className="size-7" strokeWidth={1.5} aria-hidden />
            <span className="caps text-[0.625rem] font-medium max-lg:sr-only">Menu</span>
          </button>

          <form
            action="/produits"
            role="search"
            className={cn(
              "relative px-[15px] max-lg:order-last max-lg:basis-full max-lg:pb-2 lg:flex-1 lg:px-0",
              compact && "max-lg:hidden",
            )}
          >
            <label htmlFor="site-search" className="sr-only">
              Rechercher dans le catalogue
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder="Chercher un produit, une marque, une catégorie"
              className="h-11 w-full rounded-lg bg-white pr-12 pl-4 text-base text-ldlc-strong placeholder:text-[oklch(52%_0_0)] lg:text-sm"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="absolute inset-y-0 right-[15px] flex w-11 items-center justify-center rounded-r-lg text-ldlc-text hover:text-ldlc-strong lg:right-0"
            >
              <Search className="size-6" strokeWidth={1.5} aria-hidden />
            </button>
          </form>

          <nav aria-label="Espace client" className="flex">
            {/* Pas de boutiques physiques dans le projet : BOUTIQUES mène aux indicateurs de la boutique en ligne. */}
            <Link href="/analytics" className={icon}>
              <Store className="size-7 lg:size-8" strokeWidth={1.5} aria-hidden />
              <span className={label}>Boutiques</span>
            </Link>
            <Link href="/compte" className={icon}>
              <span className="relative">
                <User className="size-7 lg:size-8" strokeWidth={1.5} aria-hidden />
                {customer && <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-header" />}
              </span>
              <span className={cn(label, "max-w-20 truncate")}>{customer ?? "Compte"}</span>
              {customer && <span className="sr-only">, connecté</span>}
            </Link>
            <Link href="/panier" className={icon}>
              <span className="relative">
                <ShoppingBag className="size-7 lg:size-8" strokeWidth={1.5} aria-hidden />
                <span className="tabular absolute -top-1.5 -right-2.5 flex size-5 min-w-5 items-center justify-center rounded-full bg-ldlc-yellow px-1 text-sm leading-none font-bold text-ldlc-strong">
                  {count}
                </span>
              </span>
              <span className={label}>Panier</span>
              <span className="sr-only">
                , {count} article{count > 1 ? "s" : ""}
              </span>
            </Link>
          </nav>

          <nav aria-label="Navigation principale" className={cn("basis-full", compact ? "hidden" : "max-lg:hidden")}>
            <ul className="flex h-10 items-stretch justify-between pr-5">
              <li className="shrink-0" {...hover}>
                <button
                  type="button"
                  aria-expanded={mega}
                  aria-controls="mega-menu"
                  // À la souris, le survol a déjà ouvert : le clic confirme au lieu de refermer. Au doigt et au clavier, il bascule.
                  onClick={(e) => {
                    const mouse = (e.nativeEvent as PointerEvent).pointerType === "mouse";
                    setMega((o) => mouse || !o);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowDown") return;
                    e.preventDefault();
                    setMega(true);
                    requestAnimationFrame(() => document.querySelector<HTMLElement>("#mega-menu a")?.focus());
                  }}
                  className={cn(
                    "caps relative flex h-10 w-[200px] items-center justify-center gap-1.5 rounded-t-lg text-[0.8125rem] font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-0.5",
                    mega ? "bg-white text-ldlc-strong" : "bg-primary text-white hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]",
                  )}
                >
                  Tous nos produits
                  <ChevronDown className={cn("size-4 transition-transform", mega && "rotate-180")} aria-hidden />
                </button>
              </li>
              {navLinks.map(({ href, label, icon: Icon }) => (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    // Barre de 40 px mesurés : la zone cliquable déborde de 2 px de chaque côté pour atteindre 44 px.
                    className="caps relative flex h-10 items-center gap-2 px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-white transition-colors after:absolute after:inset-x-0 after:-inset-y-0.5 hover:bg-white/10 active:bg-white/15"
                  >
                    <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {mega && <MegaMenu id="mega-menu" categories={categories} onClose={() => setMega(false)} hover={hover} />}
        </div>
      </header>
      <MenuDrawer open={drawer} onClose={() => setDrawer(false)} categories={categories} links={navLinks} />
    </div>
  );
}
