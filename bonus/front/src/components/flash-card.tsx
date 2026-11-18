import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { CategoryIcon } from "@/components/category-icon";
import { Stars } from "@/components/stars";
import type { ProductSummary } from "@/lib/api/types";
import { formatPrice, priceParts, priceView } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Carte produit verticale « ventes flash » (SPEC §3) : 260 px, blanche, rayon 8 ; placeholder, nom en serif bleu nuit,
 * étoiles, ancien prix barré + nouveau prix fin, panier rond bleu nuit. En promo : badge de remise et date de fin.
 */
export function FlashCard({ p, className }: { p: ProductSummary; className?: string }) {
  const v = priceView(p);
  const now = v.was ? p.effective_price : p.price;
  const { units, cents } = priceParts(now);
  return (
    <li className={cn("surface-light relative flex flex-col gap-2 rounded-lg px-2.5 pt-2.5 pb-4 sm:px-[15px] sm:pt-[15px] sm:pb-5 focus-within:ring-2 focus-within:ring-ring", className)}>
      <div className="relative grid aspect-square place-items-center bg-[oklch(96%_0_0)]" aria-hidden>
        <CategoryIcon id={p.category._id} className="size-16 text-[oklch(62%_0_0)]" />
        {v.badge && (
          <span className="tabular absolute top-2 left-2 rounded-[15px] bg-promo px-2.5 py-0.5 text-[13px] font-bold text-promo-foreground">
            {v.badge}
          </span>
        )}
      </div>
      {v.until && <p className="tabular text-xs font-bold text-promo-text">{v.label ? `${v.label} · ` : ""}{v.until}</p>}
      <h3 className="line-clamp-2 min-h-[2.5em] font-serif text-base leading-tight font-bold tracking-normal text-ldlc-night">
        <Link href={`/produits/${encodeURIComponent(p._id)}`} className="outline-none after:absolute after:inset-0 hover:underline">
          {p.name}
        </Link>
      </h3>
      <p className="truncate text-xs text-muted-foreground">
        {p.brand.name} · {p.category.name}
      </p>
      <Stars avg={p.rating.avg} count={p.rating.count} />
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <p className="tabular flex flex-wrap items-baseline gap-x-2 text-ldlc-night max-sm:flex-col">
          {v.was && (
            <del className="text-[0.9rem] text-muted-foreground">
              <span className="sr-only">au lieu de </span>
              {v.was}
            </del>
          )}
          <span className="sr-only">{formatPrice(now)}</span>
          <span aria-hidden className="text-[1.375rem] leading-none font-normal sm:text-[1.9rem] whitespace-nowrap">
            {units}€<sup className="text-[0.55em]">{cents}</sup>
          </span>
        </p>
        <AddToCart
          sku={p._id}
          round
          disabled={p.stock?.status === "out_of_stock"}
          className="relative z-10 bg-ldlc-night text-white hover:bg-[color-mix(in_oklch,var(--ldlc-night),white_15%)] active:bg-[color-mix(in_oklch,var(--ldlc-night),white_25%)]"
        />
      </div>
    </li>
  );
}
