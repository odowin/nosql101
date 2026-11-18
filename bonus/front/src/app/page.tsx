import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { getTopProducts, listProducts } from "@/lib/api/client";

const lots = [
  { n: 1, db: "MongoDB", title: "Catalogue", text: "Produits aux caractéristiques libres, filtres par specs, avis et cache Redis sur la fiche.", href: "/produits" },
  { n: 2, db: "Redis", title: "Panier et sessions", text: "Sessions et paniers à durée de vie glissante, fusion du panier à la connexion.", href: "/panier" },
  { n: 3, db: "Cassandra", title: "Analytics et commandes", text: "Vues, recherches et historique des commandes, agrégés par jour.", href: "/analytics" },
  { n: 4, db: "Neo4j", title: "Recommandations", text: "Compatibilités, achats croisés et suggestions personnalisées par graphe.", href: "/commandes" },
];

export default async function Home() {
  const [top, promos] = await Promise.all([
    getTopProducts("day", 5).catch(() => null),
    listProducts({ on_sale: true, limit: 8 }).catch(() => null),
  ]);
  return (
    <main className="flex flex-col gap-12">
      <section className="max-w-[65ch] pt-4">
        <h1 className="text-4xl font-bold">La boutique LDLC, repensée sur du NoSQL</h1>
        <p className="mt-4 text-muted-foreground">
          Quatre bases, chacune choisie pour un usage : parcourez le catalogue, remplissez un panier, passez commande et
          observez les indicateurs.
        </p>
        <Link href="/produits" className={buttonVariants({ size: "lg", className: "mt-6 min-h-11 px-5" })}>
          Voir le catalogue
        </Link>
      </section>

      {promos && promos.items.length > 0 && (
        <section aria-labelledby="promos">
          <h2 id="promos" className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Promos en cours <Badge variant="outline">MongoDB</Badge>
            <Link href="/produits?on_sale=true" className="ml-auto text-sm font-normal text-primary underline-offset-4 hover:underline">
              Toutes les promos
            </Link>
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {promos.items.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="lots">
        <h2 id="lots" className="text-xl font-semibold">Les 4 lots</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lots.map((l) => (
            <li key={l.n} className="relative flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                Lot {l.n} <Badge variant="outline">{l.db}</Badge>
              </span>
              <Link href={l.href} className="font-semibold outline-none after:absolute after:inset-0">
                {l.title}
              </Link>
              <p className="text-sm text-muted-foreground">{l.text}</p>
              <ArrowRight className="mt-auto size-4 text-primary" aria-hidden />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="top" className="max-w-xl">
        <h2 id="top" className="flex items-center gap-2 text-xl font-semibold">
          Les plus vus aujourd&apos;hui <Badge variant="outline">Cassandra</Badge>
        </h2>
        {!top ? (
          <p className="mt-2 text-sm text-muted-foreground">Classement indisponible pour le moment.</p>
        ) : top.items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Pas encore de vues aujourd&apos;hui : ouvrez quelques fiches produit.</p>
        ) : (
          <ol className="mt-2 divide-y">
            {top.items.map((i) => (
              <li key={i.sku}>
                <Link href={`/produits/${encodeURIComponent(i.sku)}`} className="flex min-h-11 items-center gap-3 hover:text-primary">
                  <span className="tabular w-5 text-muted-foreground">{i.rank}</span>
                  <span className="min-w-0 flex-1 truncate">{i.name ?? i.sku}</span>
                  <span className="tabular text-sm text-muted-foreground">
                    {i.views} vue{i.views > 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
