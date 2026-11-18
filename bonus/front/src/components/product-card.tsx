import Link from "next/link";
import { Star } from "lucide-react";
import type { ProductSummary } from "@/lib/api/types";
import { Price } from "@/components/price";

export function ProductCard({ p }: { p: ProductSummary }) {
  return (
    <li className="surface-light relative flex flex-col gap-2 rounded-xl p-4 transition-[transform,box-shadow] focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40">
      {/* Pas de photo produit : une vignette CSS réserve la place (aspect-ratio) et porte la marque. */}
      <div className="grid aspect-[16/10] place-items-center rounded-lg bg-[radial-gradient(circle_at_50%_40%,oklch(0.97_0_0),oklch(0.9_0_0))]" aria-hidden>
        <span className="text-2xl font-black tracking-tight text-neutral-400 uppercase">{p.brand.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {p.brand.name} · {p.category.name}
      </span>
      <Link href={`/produits/${encodeURIComponent(p._id)}`} className="font-medium leading-snug outline-none after:absolute after:inset-0">
        {p.name}
      </Link>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <Price p={p} className="text-lg" />
        <span className="tabular inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="size-4 fill-current text-promo" aria-hidden />
          <span className="sr-only">Note</span>
          {p.rating.count ? `${p.rating.avg.toFixed(1)} (${p.rating.count})` : "—"}
        </span>
      </div>
      {p.stock && <StockLabel status={p.stock.status} qty={p.stock.qty} />}
    </li>
  );
}

const STOCK: Record<string, [string, string]> = {
  in_stock: ["En stock", "text-success"],
  low_stock: ["Stock faible", "text-warning"],
  preorder: ["En précommande", "text-muted-foreground"],
  out_of_stock: ["Rupture de stock", "text-destructive"],
};

export function StockLabel({ status, qty }: { status: string; qty?: number }) {
  const [label, color] = STOCK[status] ?? [status, "text-muted-foreground"];
  return (
    <span className={`tabular text-sm ${color}`}>
      {label}
      {qty != null && status !== "out_of_stock" && ` (${qty})`}
    </span>
  );
}
