"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleHelp, Menu, Package, Percent, Search, ShoppingBag, Store, ThumbsUp, User } from "lucide-react";
import { CategoriesMenu } from "@/components/categories-menu";
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
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
        className={cn(
          "z-40 w-full bg-header text-white shadow-[0_1px_1px_oklch(0_0_0/25%)] pt-[env(safe-area-inset-top)]",
          compact ? "fixed inset-x-0 top-0 animate-in slide-in-from-top duration-200" : "relative",
        )}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:gap-x-4 lg:pr-[max(20px,env(safe-area-inset-right))]">
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

          {/* shortcut: le burger mène au catalogue ; le tiroir et le méga-menu arrivent avec le menu des catégories. */}
          <Link
            href="/produits"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-white/10 active:bg-white/15 max-lg:order-first max-lg:w-[54px] max-lg:border-r max-lg:border-white/20 lg:w-16",
              cell,
              !compact && "lg:hidden",
            )}
          >
            <Menu className="size-7" strokeWidth={1.5} aria-hidden />
            <span className="caps text-[0.625rem] font-medium max-lg:sr-only">Menu</span>
          </Link>

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
              <li className="shrink-0">
                <CategoriesMenu categories={categories} />
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
        </div>
      </header>
    </div>
  );
}
