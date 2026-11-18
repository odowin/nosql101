"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, PackageOpen, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { checkout, removeFromCart, setCartQuantity } from "@/app/actions";
import { CategoryIcon, skuCategory } from "@/components/category-icon";
import { Price } from "@/components/price";
import { SectionHeading } from "@/components/section-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CartLine } from "@/lib/api/types";
import { formatPrice, priceParts } from "@/lib/format";
import { cn } from "@/lib/utils";

type Change = { sku: string; quantity: number };

/** Prix LDLC « 114€<sup>95</sup> » (lu en entier par les lecteurs d'écran). */
function Euros({ v, className }: { v: number; className?: string }) {
  const { units, cents } = priceParts(v);
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      <span className="sr-only">{formatPrice(v)}</span>
      <span aria-hidden>
        {units}€<sup className="text-[0.6em]">{cents}</sup>
      </span>
    </span>
  );
}

// Grille partagée par l'en-tête de colonnes et les lignes (≥ 1024 px).
const cols = "lg:grid-cols-[90px_1fr_120px_110px_120px_44px]";

export function CartView({ items, loggedIn }: { items: CartLine[]; loggedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Affiché tout de suite ; si l'action échoue, la transition se termine sans nouvelles props et l'état revient.
  const [lines, apply] = useOptimistic(items, (cur, { sku, quantity }: Change) =>
    quantity === 0
      ? cur.filter((l) => l.sku !== sku)
      : cur.map((l) => (l.sku === sku ? { ...l, quantity, line_total: l.unit_price * quantity } : l)),
  );
  const total = lines.reduce((t, l) => t + l.line_total, 0);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  const change = (c: Change) =>
    start(async () => {
      apply(c);
      const r = c.quantity === 0 ? await removeFromCart({ sku: c.sku }) : await setCartQuantity(c);
      if (!r.ok) toast.error(`${r.error} — modification annulée`);
    });

  const order = () =>
    start(async () => {
      const r = await checkout();
      if (r.ok) router.push(`/panier/confirmation/${encodeURIComponent(r.data.order_id)}`);
      else toast.error(r.error);
    });

  if (!lines.length)
    return (
      <section aria-labelledby="cart-title" className="py-4">
        <SectionHeading inner as="h1" id="cart-title" title="Votre panier est vide… (ou presque)" />
        {/* Illustration CSS (pas de visuel LDLC) : carton ouvert et bulle avec l'appel à l'action. */}
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-center md:gap-12">
          <div aria-hidden className="grid size-56 place-items-center rounded-full bg-card md:size-72">
            <PackageOpen className="size-28 text-[oklch(62%_0_0)] md:size-36" strokeWidth={1} />
          </div>
          <div className="relative flex flex-col items-center gap-4 border-2 border-[oklch(75%_0_0)] bg-background px-8 py-6 text-center after:absolute after:-bottom-[11px] after:left-10 after:size-5 after:rotate-45 after:border-r-2 after:border-b-2 after:border-[oklch(75%_0_0)] after:bg-background max-md:after:hidden">
            <p className="text-xl font-bold text-muted-foreground italic">Le carton attend son premier article !</p>
            <Link href="/produits" className={buttonVariants({ variant: "navy", size: "pill" })}>
              Trouver l&apos;inspiration <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    );

  const cta = loggedIn ? (
    <Button variant="buy" size="pill-lg" onClick={order} disabled={pending} className="w-full">
      {pending ? "Patientez…" : "Passer commande"}
    </Button>
  ) : (
    <Link
      href="/connexion?retour=/panier"
      aria-label="Identifiez-vous pour passer commande"
      className={buttonVariants({ variant: "navy", size: "pill", className: "w-full" })}
    >
      S&apos;identifier
    </Link>
  );

  return (
    <section aria-labelledby="cart-title" className="bloc">
      <SectionHeading inner as="h1" id="cart-title" title="Votre panier" />
      <div className="grid gap-6 lg:grid-cols-[1fr_316px] lg:items-start">
        <div>
          <div aria-hidden className={cn("caps hidden border-b-2 border-border pb-2 text-[0.8125rem] text-muted-foreground lg:grid lg:gap-x-4", cols)}>
            <span className="col-start-2">Désignation</span>
            <span className="text-right">Prix</span>
            <span className="text-center">Quantité</span>
            <span className="text-right">Sous-total</span>
            <Trash2 className="size-5 justify-self-center" strokeWidth={1.5} />
          </div>
          <ul className="divide-y border-b border-border">
            {lines.map((l) => (
              <li key={l.sku} className={cn("grid grid-cols-[70px_1fr_44px] items-center gap-x-4 gap-y-3 py-4", cols)}>
                <div aria-hidden className="row-span-2 grid aspect-square place-items-center self-start bg-[oklch(95%_0_0)] lg:row-span-1">
                  <CategoryIcon id={skuCategory(l)} className="size-8 text-[oklch(62%_0_0)]" />
                </div>
                <Link
                  href={`/produits/${encodeURIComponent(l.sku)}`}
                  className="min-w-0 text-[15px] font-bold text-ldlc-strong underline-offset-4 hover:underline lg:col-auto"
                >
                  {l.name}
                </Link>
                <Price p={l} className="justify-end text-right max-lg:hidden" />
                <div className="flex items-center gap-4 max-lg:col-start-2 max-lg:row-start-2 lg:contents">
                  <label className="lg:justify-self-center">
                    <span className="sr-only">Quantité de {l.name}</span>
                    <select
                      value={l.quantity}
                      onChange={(e) => change({ sku: l.sku, quantity: Number(e.target.value) })}
                      className="tabular h-11 w-[70px] rounded-lg border border-border bg-white pr-8 pl-3"
                    >
                      {Array.from({ length: Math.max(10, l.quantity) }, (_, i) => (
                        <option key={i} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  <Euros v={l.line_total} className="text-right text-base font-bold text-ldlc-strong lg:justify-self-end" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer ${l.name}`}
                  onClick={() => change({ sku: l.sku, quantity: 0 })}
                  className="max-lg:col-start-3 max-lg:row-start-1 max-lg:self-start"
                >
                  <X className="size-6" strokeWidth={1.5} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {/* Récapitulatif bleu pâle, collant sous l'en-tête compact (50 px). */}
        <aside aria-label="Récapitulatif" className="flex flex-col gap-4 lg:sticky lg:top-[70px]">
          <div className="flex flex-col items-center gap-4 rounded-lg bg-ldlc-pale p-5 text-center">
            <p className="flex flex-col">
              <span className="caps text-xl text-ldlc-text">Total TTC</span>
              <Euros v={total} className="text-[28px] leading-tight font-bold text-ldlc-price" />
              <span className="tabular text-sm text-muted-foreground">
                {count} article{count > 1 ? "s" : ""}
              </span>
            </p>
            <hr className="w-full border-t-2 border-white" />
            {!loggedIn && <p className="text-sm text-ldlc-text">Identifiez-vous pour passer commande.</p>}
            {cta}
          </div>
          <p className="text-sm text-muted-foreground">Prix TTC. Livraison simulée : la commande est enregistrée dès la validation.</p>
        </aside>
      </div>

      {/* Mobile : barre collante total + commande, au-dessus de la barre d'accueil du téléphone. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 bg-white px-[15px] pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-2px_6px_oklch(0_0_0/15%)] lg:hidden">
        <Euros v={total} className="text-xl font-bold text-ldlc-price" />
        <div className="max-w-60 flex-1">{cta}</div>
      </div>
    </section>
  );
}
