"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import type { Suggestions } from "@/app/suggestions/route";
import { CategoryIcon } from "@/components/category-icon";
import { Price } from "@/components/price";
import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/utils";

const LIST = "search-suggestions";

/**
 * Recherche de l'en-tête : combobox ARIA (flèches, Entrée, Échap) avec suggestions après 200 ms sans frappe.
 * Entrée sans suggestion active : envoi normal du formulaire vers /produits?q=.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/suggestions?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Suggestions | null) => {
          setData(d);
          setActive(-1);
        })
        .catch(() => {}); // frappe suivante (abort) ou réseau : on garde les suggestions affichées
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const options = [
    ...(data?.queries ?? []).map((s) => ({ href: `/produits?q=${encodeURIComponent(s)}` })),
    ...(data?.products ?? []).map((p) => ({ href: `/produits/${encodeURIComponent(p.sku)}` })),
  ];
  const show = open && term.length >= 2 && options.length > 0;
  const nq = data?.queries.length ?? 0;
  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycle sur -1 (le champ) puis 0…n-1 (les options).
      setActive((a) => ((a + 1 + step + options.length + 1) % (options.length + 1)) - 1);
    } else if (e.key === "Enter" && show && active >= 0 && active < options.length) {
      e.preventDefault();
      close();
      router.push(options[active].href);
    } else if (e.key === "Escape") {
      if (show) close();
      else setQ("");
    }
  };

  const option = (i: number) => ({
    id: `${LIST}-${i}`,
    role: "option",
    "aria-selected": i === active,
    tabIndex: -1,
    // Garde le focus dans le champ pendant le clic ; le lien navigue ensuite.
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: close,
  });

  return (
    <form action="/produits" role="search" className={cn("relative", className)}>
      <label htmlFor="site-search" className="sr-only">
        Rechercher dans le catalogue
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={show}
        aria-controls={LIST}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${LIST}-${active}` : undefined}
        autoComplete="off"
        placeholder="Chercher un produit, une marque, une catégorie"
        className={cn(
          "h-11 w-full bg-white pr-12 pl-4 text-base [&::-webkit-search-cancel-button]:appearance-none text-ldlc-strong placeholder:text-[oklch(52%_0_0)] lg:text-sm",
          show ? "rounded-t-lg" : "rounded-lg",
        )}
      />
      <button
        type="submit"
        aria-label="Rechercher"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ldlc-text hover:text-ldlc-strong"
      >
        <Search className="size-6" strokeWidth={1.5} aria-hidden />
      </button>
      <p className="sr-only" aria-live="polite">
        {show ? `${options.length} suggestion${options.length > 1 ? "s" : ""}` : ""}
      </p>

      <div
        id={LIST}
        role="listbox"
        aria-label="Suggestions de recherche"
        hidden={!show}
        className="absolute inset-x-0 top-full z-50 origin-top overflow-hidden rounded-b-lg border-t border-border bg-white pb-1 text-ldlc-text shadow-[0_8px_16px_oklch(0_0_0/25%)] animate-in fade-in zoom-in-95 duration-150"
      >
        {nq > 0 && (
          <div role="group" aria-labelledby={`${LIST}-q`}>
            <p id={`${LIST}-q`} className="caps flex items-center gap-2 px-5 pt-4 pb-1 text-sm font-bold text-primary">
              <Search className="size-4" aria-hidden /> Suggestions
            </p>
            {data!.queries.map((s, i) => (
              <Link
                key={s}
                href={options[i].href}
                {...option(i)}
                className="flex min-h-11 items-center px-5 text-sm text-ldlc-text hover:bg-ldlc-alt aria-selected:bg-ldlc-pale"
              >
                <span>
                  {highlight(s, term).map((p, j) => (p.match ? <strong key={j} className="font-bold text-ldlc-strong">{p.text}</strong> : p.text))}
                </span>
              </Link>
            ))}
          </div>
        )}
        {data && data.products.length > 0 && (
          <div role="group" aria-labelledby={`${LIST}-p`}>
            <p id={`${LIST}-p`} className="caps flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-bold text-primary">
              <Star className="size-4" aria-hidden /> Recommandations
            </p>
            {data.products.map((p, j) => (
              <Link
                key={p.sku}
                href={options[nq + j].href}
                {...option(nq + j)}
                className="flex min-h-16 items-center gap-4 px-5 py-2 odd:bg-ldlc-alt hover:bg-ldlc-pale aria-selected:bg-ldlc-pale"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded bg-white text-[oklch(52%_0_0)] ring-1 ring-border">
                  <CategoryIcon id={p.categoryId} className="size-6" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold text-ldlc-strong">{p.name}</span>
                  <span className="text-xs text-[oklch(52%_0_0)]">{p.category}</span>
                </span>
                <Price p={p} className="shrink-0 text-base font-bold text-ldlc-price" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
