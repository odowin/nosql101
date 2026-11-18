"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions";
import { CategoryIcon, skuCategory } from "@/components/category-icon";
import { Price } from "@/components/price";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Recommendation } from "@/lib/api/types";

type Props = {
  sku: string;
  name: string;
  category: string;
  priceLabel: string;
  maxQty: number;
  disabled?: boolean;
  crossSell: Recommendation[];
};

/**
 * Ligne d'action de la fiche : quantité · AJOUTER AU PANIER (jaune) · ACHETER (orange, ajoute puis ouvre le panier).
 * L'ajout ouvre aussitôt le panneau « ajouté au panier » (optimiste) et le referme avec un message si l'API refuse.
 * Sous 1024 px, une barre d'achat collante prend le relais quand la ligne d'action sort de l'écran.
 */
export function BuyBox({ sku, name, category, priceLabel, maxQty, disabled, crossSell }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [sticky, setSticky] = useState(false);
  const panel = useRef<HTMLDialogElement>(null);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // Visible seulement une fois la ligne d'action dépassée vers le haut.
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const add = (thenCart: boolean) => {
    if (!thenCart) panel.current?.showModal();
    start(async () => {
      const r = await addToCart({ sku, quantity: qty });
      if (!r.ok) {
        panel.current?.close();
        return void toast.error(r.error);
      }
      if (thenCart) router.push("/panier");
    });
  };

  const off = disabled || pending;
  return (
    <>
      <div ref={row} className="flex flex-wrap items-center gap-3">
        <label htmlFor="qty" className="sr-only">Quantité</label>
        <select
          id="qty"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={disabled}
          className="tabular h-11 w-[70px] rounded-lg border border-border bg-white pl-3 pr-8"
        >
          {Array.from({ length: Math.max(1, Math.min(10, maxQty)) }, (_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <Button variant="buy" size="pill" onClick={() => add(false)} disabled={off} aria-haspopup="dialog" className="max-sm:flex-1">
          <ShoppingCart aria-hidden /> Ajouter au panier
        </Button>
        <Button variant="buyNow" size="pill" onClick={() => add(true)} disabled={off} className="max-sm:basis-full">
          <Zap aria-hidden /> {pending ? "Ajout…" : "Acheter"}
        </Button>
      </div>

      {/* Barre d'achat collante (mobile) : hors écran et inerte tant que la ligne d'action est visible. */}
      <div
        inert={!sticky}
        className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-1px_4px_oklch(0%_0_0/10%)] transition-[translate] duration-200 lg:hidden ${sticky ? "" : "translate-y-full"}`}
      >
        <span className="tabular text-xl font-bold text-ldlc-price">{priceLabel}</span>
        <Button variant="buy" size="pill" onClick={() => add(false)} disabled={off} aria-haspopup="dialog">
          <ShoppingCart aria-hidden /> Ajouter au panier
        </Button>
      </div>

      <dialog
        ref={panel}
        aria-labelledby="added-title"
        className="side-panel fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-lg bg-white p-0 pb-[env(safe-area-inset-bottom)] text-(--text) lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[600px] lg:rounded-none"
      >
        <div className="relative flex flex-col gap-4 bg-ldlc-pale px-[30px] py-5">
          <p id="added-title" className="caps flex items-center gap-2 pr-10 text-lg font-bold tracking-normal text-success">
            <Check className="size-7" aria-hidden /> Cet article a bien été ajouté au panier
          </p>
          <Button variant="ghost" size="icon" aria-label="Fermer" onClick={() => panel.current?.close()} className="absolute top-1 right-1">
            <X className="size-6" aria-hidden />
          </Button>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-20 shrink-0 place-items-center bg-white" aria-hidden>
              <CategoryIcon id={category} className="size-10 text-[oklch(62%_0_0)]" />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-bold text-ldlc-strong">{name}</p>
              <p className="tabular">Quantité : {qty}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/panier" className={buttonVariants({ variant: "buy", size: "pill" })}>Voir mon panier ›</Link>
            <Button variant="outlineNavy" size="pill" onClick={() => panel.current?.close()}>Continuer mes achats</Button>
          </div>
        </div>

        {crossSell.length > 0 && (
          <section aria-labelledby="cross-title" className="px-[30px] py-6">
            <h2 id="cross-title" className="text-base font-bold tracking-normal text-ldlc-strong">Souvent achetés ensemble :</h2>
            <ul className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
              {crossSell.slice(0, 4).map((r) => (
                <li key={r.sku}>
                  <Link href={`/produits/${encodeURIComponent(r.sku)}`} onClick={() => panel.current?.close()} className="group flex flex-col gap-2 rounded-lg p-1 text-[13px] text-ldlc-price">
                    <span className="grid aspect-square place-items-center bg-[oklch(95%_0_0)]" aria-hidden>
                      <CategoryIcon id={skuCategory(r)} className="size-10 text-[oklch(62%_0_0)]" />
                    </span>
                    <span className="line-clamp-2 group-hover:underline">{r.name}</span>
                    <Price p={r} className="text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </dialog>
    </>
  );
}
