"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { checkout, removeFromCart, setCartQuantity } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/api/types";
import { Price } from "@/components/price";
import { formatPrice } from "@/lib/format";

type Change = { sku: string; quantity: number };

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
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        Votre panier est vide.{" "}
        <Link href="/produits" className="text-primary underline underline-offset-4">
          Parcourir le catalogue
        </Link>
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
        {lines.map((l) => (
          <li key={l.sku} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1 basis-48">
              <Link href={`/produits/${encodeURIComponent(l.sku)}`} className="font-medium hover:text-primary">
                {l.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                <Price p={l} /> l&apos;unité
              </p>
            </div>
            <div className="flex items-center" role="group" aria-label={`Quantité de ${l.name}`}>
              <Button variant="outline" size="icon" className="size-11" aria-label="Retirer un" onClick={() => change({ sku: l.sku, quantity: l.quantity - 1 })}>
                <Minus aria-hidden />
              </Button>
              <span className="tabular w-10 text-center" aria-live="polite">
                {l.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Ajouter un"
                disabled={l.quantity >= 99}
                onClick={() => change({ sku: l.sku, quantity: l.quantity + 1 })}
              >
                <Plus aria-hidden />
              </Button>
            </div>
            <span className="tabular w-28 text-right font-semibold">{formatPrice(l.line_total)}</span>
            <Button variant="ghost" size="icon" className="size-11" aria-label={`Supprimer ${l.name}`} onClick={() => change({ sku: l.sku, quantity: 0 })}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <p className="text-lg">
          Total <span className="tabular ml-2 text-2xl font-bold">{formatPrice(total)}</span>
        </p>
        <Button onClick={order} disabled={pending || !loggedIn} className="min-h-11 px-6 text-base">
          {pending ? "Patientez…" : "Commander"}
        </Button>
      </div>
      {!loggedIn && <p className="text-right text-sm text-muted-foreground">Connectez-vous pour passer commande.</p>}
    </div>
  );
}
