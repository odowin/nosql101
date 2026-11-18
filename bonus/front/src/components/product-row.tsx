import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { CategoryIcon } from "@/components/category-icon";
import { PriceTag } from "@/components/price-tag";
import { STOCK } from "@/components/product-card";
import { Stars } from "@/components/stars";
import type { ProductSummary } from "@/lib/api/types";

/**
 * Carte produit LIGNE (SPEC §3) : 160 px, lignes alternées ; image · infos · bloc DISPO · prix + panier rond.
 * Sous 1024 px : image de 90 px, titre enchaîné avec la description, dispo sur une ligne, prix et panier en bas.
 */
export function ProductRow({ p, description }: { p: ProductSummary; description?: string }) {
  const [stock, color] = STOCK[p.stock?.status ?? ""] ?? ["Indisponible", "text-muted-foreground"];
  return (
    <li className="relative grid grid-cols-[90px_1fr] gap-x-4 gap-y-2 bg-(--row) px-[15px] py-4 [--row:var(--card)] odd:[--row:var(--ldlc-alt)] lg:min-h-40 lg:grid-cols-[150px_1fr_130px_120px] lg:items-center lg:gap-x-8 lg:px-[30px] lg:py-[5px]">
      {/* Pas de photo produit : placeholder neutre à ratio fixe, picto de la catégorie. */}
      <div className="row-span-3 grid aspect-square place-items-center self-start bg-[oklch(93%_0_0)] lg:row-span-1 lg:self-center" aria-hidden>
        <CategoryIcon id={p.category._id} className="size-10 text-[oklch(62%_0_0)] lg:size-14" />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-[0.8125rem] leading-snug max-lg:line-clamp-4 font-bold tracking-normal text-ldlc-strong lg:text-[15px]">
          <Link href={`/produits/${encodeURIComponent(p._id)}`} className="outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
            {p.name}
          </Link>
          {description && <span className="font-medium text-muted-foreground lg:hidden"> {description}</span>}
        </h3>
        {description && <p className="line-clamp-2 hidden text-xs text-muted-foreground lg:block">{description}</p>}
        <span className="hidden lg:block">
          <Stars avg={p.rating.avg} count={p.rating.count} />
        </span>
      </div>

      {/* Bloc DISPO : étiquette qui chevauche le cadre (fond de la ligne derrière). */}
      <div className="text-xs lg:relative lg:rounded-lg lg:border-2 lg:border-border lg:px-2 lg:pt-3 lg:pb-2 lg:text-center">
        <span className="font-bold tracking-[2px] text-muted-foreground uppercase lg:absolute lg:-top-2 lg:left-1/2 lg:-translate-x-1/2 lg:bg-(--row) lg:px-1.5 lg:text-[11px]">
          Dispo
        </span>
        <span className="text-[10px] text-muted-foreground max-lg:ml-1 lg:block">Web{" "}<span className="lg:hidden">: </span></span>
        <span className={`font-bold uppercase lg:block ${color}`}>{stock}</span>
      </div>

      <div className="col-start-2 flex items-end justify-between gap-3 lg:col-start-auto lg:flex-col lg:items-end lg:justify-center">
        <PriceTag p={p} className="max-lg:items-start" />
        <AddToCart sku={p._id} round disabled={p.stock?.status === "out_of_stock"} className="relative z-10" />
      </div>
    </li>
  );
}
