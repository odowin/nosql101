"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Ligne d'action de la fiche : quantité · AJOUTER AU PANIER (jaune) · ACHETER (orange, ajoute puis ouvre le panier). */
export function BuyBox({ sku, maxQty, disabled }: { sku: string; maxQty: number; disabled?: boolean }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();

  const add = (thenCart: boolean) =>
    start(async () => {
      const r = await addToCart({ sku, quantity: qty });
      if (!r.ok) return void toast.error(r.error);
      if (thenCart) router.push("/panier");
      else toast.success("Ajouté au panier");
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
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
      <Button variant="buy" size="pill" onClick={() => add(false)} disabled={disabled || pending} className="max-sm:flex-1">
        <ShoppingCart aria-hidden /> {pending ? "Ajout…" : "Ajouter au panier"}
      </Button>
      <Button variant="buyNow" size="pill" onClick={() => add(true)} disabled={disabled || pending} className="max-sm:basis-full">
        <Zap aria-hidden /> Acheter
      </Button>
    </div>
  );
}
