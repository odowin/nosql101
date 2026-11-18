import { Badge } from "@/components/ui/badge";
import type { PriceInfo } from "@/lib/api/types";
import { formatPrice, priceParts, priceView } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Prix des lignes produit : 26/700 bleu prix, centimes en exposant ; en promo, prix de référence barré et remise. */
export function PriceTag({ p, className }: { p: PriceInfo; className?: string }) {
  const v = priceView(p);
  const { units, cents } = priceParts(v.was ? p.effective_price : p.price);
  return (
    <span className={cn("tabular flex flex-col items-end gap-0.5", className)}>
      {v.was && (
        <span className="flex items-center gap-2">
          {v.badge && <Badge variant="promo">{v.badge}</Badge>}
          <del className="text-sm text-muted-foreground">
            <span className="sr-only">au lieu de </span>
            {v.was}
          </del>
        </span>
      )}
      <span className="sr-only">{formatPrice(v.was ? p.effective_price : p.price)}</span>
      <span aria-hidden className="text-[26px] leading-none font-bold whitespace-nowrap text-ldlc-price">
        {units}€<sup className="text-[17px] font-bold">{cents}</sup>
      </span>
    </span>
  );
}
