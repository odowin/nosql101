import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import { TrackEvent } from "@/components/track-event";
import { getCategories, getProduct, listProducts } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { PAGE_SIZE, parseCatalogFilters } from "@/lib/catalog-filters";
import { withParams } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalogue · LDLC NoSQL" };

type SP = Record<string, string | string[] | undefined>;

const flatten = (cats: Category[], depth = 0): { id: string; label: string }[] =>
  cats.flatMap((c) => [{ id: c._id, label: `${"  ".repeat(depth)}${c.name}` }, ...flatten(c.children, depth + 1)]);

/** Facettes k → valeurs, tirées des specs des produits listés (la liste API ne renvoie pas les specs). */
async function specFacets(skus: string[]) {
  const facets = new Map<string, { label: string; values: Set<string> }>();
  for (const r of await Promise.allSettled(skus.map(getProduct))) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value.specs ?? []) {
      const f = facets.get(s.k) ?? { label: s.label ?? s.k, values: new Set() };
      f.values.add(String(s.v));
      facets.set(s.k, f);
    }
  }
  // Une facette à une seule valeur ne filtre rien ; au-delà de 8 valeurs, elle n'est plus lisible.
  return [...facets].filter(([, f]) => f.values.size > 1 && f.values.size <= 8).slice(0, 8);
}

const field = "flex flex-col gap-1.5 text-sm font-medium";
const control = "h-11 w-full";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = parseCatalogFilters(sp);
  const [page, categories] = await Promise.all([listProducts(query), getCategories().catch(() => [])]);
  const facets = query.category ? await specFacets(page.items.map((p) => p._id)) : [];
  const selected = new Set(query.spec);
  const brands = new Map(page.items.map((p) => [p.brand._id, p.brand.name]));
  if (query.brand && !brands.has(query.brand)) brands.set(query.brand, query.brand);
  const current = Math.floor((query.skip ?? 0) / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));

  return (
    <main className="grid gap-8 md:grid-cols-[16rem_1fr]">
      {query.q && <TrackEvent event_type="search" search_query={query.q} />}
      <header className="md:col-span-2">
        <h1 className="text-3xl font-bold">Catalogue</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="tabular">
            {page.total} produit{page.total > 1 ? "s" : ""}
          </span>
          <Badge variant="outline">MongoDB</Badge>
        </p>
      </header>

      <form action="/produits" className="flex flex-col gap-4" aria-label="Filtres du catalogue">
        <label className={field}>
          Recherche
          <Input type="search" name="q" defaultValue={query.q ?? ""} placeholder="ex. SSD NVMe" className={control} />
        </label>
        <label className={field}>
          Catégorie
          <select name="category" defaultValue={query.category ?? ""} className={cn(control, "rounded-lg border border-input bg-transparent px-2")}>
            <option value="">Toutes</option>
            {flatten(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Marque
          <select name="brand" defaultValue={query.brand ?? ""} className={cn(control, "rounded-lg border border-input bg-transparent px-2")}>
            <option value="">Toutes</option>
            {[...brands].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-sm font-medium">Prix (€)</legend>
          <label className="sr-only" htmlFor="min_price">Prix minimum</label>
          <Input id="min_price" name="min_price" inputMode="decimal" placeholder="min" defaultValue={query.min_price ?? ""} className={control} />
          <label className="sr-only" htmlFor="max_price">Prix maximum</label>
          <Input id="max_price" name="max_price" inputMode="decimal" placeholder="max" defaultValue={query.max_price ?? ""} className={control} />
        </fieldset>

        {query.category ? (
          facets.map(([k, f]) => (
            <fieldset key={k}>
              <legend className="mb-1 text-sm font-medium">{f.label}</legend>
              {[...f.values].sort().map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="spec" value={`${k}:${v}`} defaultChecked={selected.has(`${k}:${v}`)} className="size-4 accent-primary" />
                  {v}
                </label>
              ))}
            </fieldset>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Choisissez une catégorie pour filtrer par caractéristiques.</p>
        )}
        {/* Specs déjà choisies mais absentes des facettes (page suivante, autre catégorie) : gardées. */}
        {query.spec
          ?.filter((s) => !facets.some(([k, f]) => s.startsWith(`${k}:`) && f.values.has(s.slice(k.length + 1))))
          .map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="spec" value={s} defaultChecked className="size-4 accent-primary" />
              {s}
            </label>
          ))}

        <div className="flex gap-2">
          <Button type="submit" className="min-h-11 flex-1">
            Filtrer
          </Button>
          <Link href="/produits" className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
            Réinitialiser
          </Link>
        </div>
      </form>

      <section aria-label="Résultats">
        {page.items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Aucun produit ne correspond à ces filtres.</p>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-2">
            <PageLink sp={sp} page={current - 1} disabled={current <= 1}>
              Précédent
            </PageLink>
            <span className="tabular text-sm text-muted-foreground" aria-current="page">
              Page {current} sur {pages}
            </span>
            <PageLink sp={sp} page={current + 1} disabled={current >= pages}>
              Suivant
            </PageLink>
          </nav>
        )}
      </section>
    </main>
  );
}

function PageLink({ sp, page, disabled, children }: { sp: SP; page: number; disabled: boolean; children: string }) {
  const cls = buttonVariants({ variant: "outline", className: "min-h-11 min-w-24" });
  if (disabled) return <span className={cn(cls, "pointer-events-none opacity-50")} aria-disabled>{children}</span>;
  return (
    <Link href={withParams("/produits", sp, { page: page > 1 ? String(page) : undefined })} className={cls}>
      {children}
    </Link>
  );
}
