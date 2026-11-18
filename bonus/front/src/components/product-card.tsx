import Link from "next/link";
import { Star } from "lucide-react";
import type { ProductSummary } from "@/lib/api/types";
import { Price } from "@/components/price";

export function ProductCard({ p }: { p: ProductSummary }) {
  return (
    <li className="relative flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <span className="text-xs text-muted-foreground">
        {p.brand.name} · {p.category.name}
      </span>
      <Link href={`/produits/${encodeURIComponent(p._id)}`} className="font-medium leading-snug outline-none after:absolute after:inset-0">
        {p.name}
      </Link>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <Price p={p} className="text-lg" />
        <span className="tabular inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="size-4 fill-current text-primary" aria-hidden />
          <span className="sr-only">Note</span>
          {p.rating.count ? `${p.rating.avg.toFixed(1)} (${p.rating.count})` : "—"}
        </span>
      </div>
      {p.stock && <StockLabel status={p.stock.status} qty={p.stock.qty} />}
    </li>
  );
}

const STOCK: Record<string, [string, string]> = {
  in_stock: ["En stock", "text-emerald-700 dark:text-emerald-400"],
  low_stock: ["Stock faible", "text-amber-700 dark:text-amber-400"],
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
