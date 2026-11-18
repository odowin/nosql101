"use client";

import { useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function AddToCart({ sku, disabled }: { sku: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const add = () =>
    start(async () => {
      const r = await addToCart({ sku, quantity: 1 });
      if (r.ok) toast.success("Ajouté au panier");
      else toast.error(r.error);
    });
  return (
    <Button onClick={add} disabled={disabled || pending} className="min-h-11 px-5 text-base">
      <ShoppingCart aria-hidden /> {pending ? "Ajout…" : "Ajouter au panier"}
    </Button>
  );
}
