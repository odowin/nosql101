import Link from "next/link";
import { getRecommendations } from "@/lib/api/client";
import type { RecoKind } from "@/lib/api/types";
import { formatPrice } from "@/lib/format";

/** Une section de recommandations Neo4j ; vide ou en erreur, elle le dit sans casser la page. */
export async function RecoSection({ sku, kind, title }: { sku: string; kind: RecoKind; title: string }) {
  const items = await getRecommendations(sku, kind).catch(() => null);
  return (
    <section aria-label={title} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="font-semibold">{title}</h3>
      {items === null ? (
        <p className="mt-2 text-sm text-muted-foreground">Recommandations indisponibles pour le moment.</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucune suggestion pour ce produit.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {items.slice(0, 5).map((r) => (
            <li key={r.sku}>
              <Link href={`/produits/${encodeURIComponent(r.sku)}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                <span>{r.name}</span>
                <span className="tabular shrink-0 text-muted-foreground">{formatPrice(r.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
