import { Badge } from "@/components/ui/badge";
import type { PriceInfo } from "@/lib/api/types";
import { priceView } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Prix effectif, prix de référence barré et remise ; `detailed` ajoute le libellé et la date de fin (fiche). */
export function Price({ p, detailed, className }: { p: PriceInfo; detailed?: boolean; className?: string }) {
  const v = priceView(p);
  return (
    <span className={cn("tabular inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className="font-semibold">{v.now}</span>
      {v.was && (
        <del className="text-[0.7em] font-normal text-muted-foreground">
          <span className="sr-only">au lieu de </span>
          {v.was}
        </del>
      )}
      {v.badge && <Badge variant="destructive" className="self-center">{v.badge}</Badge>}
      {detailed && v.label && (
        <span className="basis-full text-sm font-normal text-muted-foreground">
          {v.label} · {v.until}
        </span>
      )}
    </span>
  );
}
