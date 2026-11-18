import Link from "next/link";
import type { Recommendation } from "@/lib/api/types";
import { Price } from "@/components/price";

/** Une section de recommandations Neo4j ; vide ou en erreur, elle le dit sans casser la page. */
export async function RecoSection({ title, items: load }: { title: string; items: Promise<Recommendation[]> }) {
  const items = await load.catch(() => null);
  return (
    <section aria-label={title} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="font-semibold">{title}</h3>
      {items === null ? (
        <p className="mt-2 text-sm text-muted-foreground">Recommandations indisponibles pour le moment.</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucune suggestion pour le moment.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {items.slice(0, 5).map((r) => (
            <li key={r.sku}>
              <Link href={`/produits/${encodeURIComponent(r.sku)}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-link">
                <span>{r.name}</span>
                <Price p={r} className="shrink-0 justify-end text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
