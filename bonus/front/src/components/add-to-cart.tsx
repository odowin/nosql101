"use client";

import { useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** `round` : bouton rond jaune de 44 px des lignes produit (libellé pour les lecteurs d'écran seulement). */
export function AddToCart({ sku, disabled, round, className }: { sku: string; disabled?: boolean; round?: boolean; className?: string }) {
  const [pending, start] = useTransition();
  const add = () =>
    start(async () => {
      const r = await addToCart({ sku, quantity: 1 });
      if (r.ok) toast.success("Ajouté au panier");
      else toast.error(r.error);
    });
  if (round)
    return (
      <Button onClick={add} disabled={disabled || pending} variant="buy" size="pill-icon" aria-label={pending ? "Ajout en cours" : "Ajouter au panier"} className={className}>
        <ShoppingCart className="size-5" aria-hidden />
      </Button>
    );
  return (
    <Button onClick={add} disabled={disabled || pending} className="min-h-11 px-5 text-base">
      <ShoppingCart aria-hidden /> {pending ? "Ajout…" : "Ajouter au panier"}
    </Button>
  );
}
