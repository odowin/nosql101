import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { Carousel } from "@/components/carousel";
import { CategoryIcon, skuCategory } from "@/components/category-icon";
import { Price } from "@/components/price";
import type { Recommendation } from "@/lib/api/types";

/** Carte produit verticale des carrousels (≈ 210 px) : placeholder, panier rond en surimpression, nom sur 2 lignes, prix. */
function RecoCard({ r }: { r: Recommendation }) {
  return (
    <li className="relative flex w-[160px] shrink-0 snap-start flex-col gap-2 lg:w-[210px]">
      <div className="relative grid aspect-square place-items-center bg-[oklch(95%_0_0)]" aria-hidden>
        <CategoryIcon id={skuCategory(r)} className="size-12 text-[oklch(62%_0_0)]" />
      </div>
      <AddToCart sku={r.sku} round className="absolute top-2 right-2 z-10" />
      <Link href={`/produits/${encodeURIComponent(r.sku)}`} className="line-clamp-2 text-sm text-ldlc-text outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
        {r.name}
      </Link>
      <Price p={r} className="text-lg font-bold text-ldlc-price" />
    </li>
  );
}

/** Recommandations Neo4j en carrousel ; vide ou en erreur, elles le disent sans casser la page. */
export async function RecoCarousel({ label, items: load }: { label: string; items: Promise<Recommendation[]> }) {
  const items = await load.catch(() => null);
  if (!items?.length)
    return <p className="py-4 text-muted-foreground">{items ? "Aucune suggestion pour le moment." : "Recommandations indisponibles pour le moment."}</p>;
  return (
    <Carousel label={label}>
      {items.map((r) => (
        <RecoCard key={r.sku} r={r} />
      ))}
    </Carousel>
  );
}
