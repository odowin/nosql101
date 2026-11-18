import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { FilterSheet } from "@/components/filter-sheet";
import { PriceRange } from "@/components/price-range";
import { ProductRow } from "@/components/product-row";
import { SectionHeading } from "@/components/section-heading";
import { SortSelect } from "@/components/sort-select";
import { TrackEvent } from "@/components/track-event";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategories, getProduct, listProducts } from "@/lib/api/client";
import type { Category, Product } from "@/lib/api/types";
import { categoryHref, categoryTrail } from "@/lib/categories";
import { PAGE_SIZE, SORT_OPTIONS, pageList, parseCatalogFilters } from "@/lib/catalog-filters";
import { specSummary, withParams } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalogue · LDLC NoSQL" };

type SP = Record<string, string | string[] | undefined>;

const flatten = (cats: Category[], depth = 0): { id: string; label: string }[] =>
  cats.flatMap((c) => [{ id: c._id, label: `${"  ".repeat(depth)}${c.name}` }, ...flatten(c.children, depth + 1)]);

/** Facettes k → valeurs, tirées des specs des produits listés (la liste API ne renvoie pas les specs). */
function specFacets(details: Product[]) {
  const facets = new Map<string, { label: string; values: Set<string> }>();
  for (const s of details.flatMap((d) => d.specs ?? [])) {
    const f = facets.get(s.k) ?? { label: s.label ?? s.k, values: new Set() };
    f.values.add(String(s.v));
    facets.set(s.k, f);
  }
  // Une facette à une seule valeur ne filtre rien ; au-delà de 8 valeurs, elle n'est plus lisible.
  return [...facets].filter(([, f]) => f.values.size > 1 && f.values.size <= 8).slice(0, 8);
}

const filterLabel = "caps mb-1.5 block text-xs font-medium text-ldlc-text";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = parseCatalogFilters(sp);
  const { category, q, on_sale, in_stock } = query;
  // shortcut: marques, compteurs et bornes de prix viennent des 100 premiers produits du périmètre (limite API) ; à remplacer par une route de facettes si le catalogue grossit.
  const [page, scope, categories] = await Promise.all([
    listProducts(query),
    listProducts({ category, q, on_sale, in_stock, limit: 100 }).catch(() => null),
    getCategories().catch(() => []),
  ]);
  const details = (await Promise.allSettled(page.items.map((p) => getProduct(p._id))))
    .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const descriptions = new Map(details.map((d) => [d._id, specSummary(d.specs ?? [])]));
  const facets = category ? specFacets(details) : [];
  const selectedSpecs = new Set(query.spec);

  const brandCounts = new Map<string, { name: string; n: number }>();
  for (const p of scope?.items ?? []) {
    const b = brandCounts.get(p.brand._id) ?? { name: p.brand.name, n: 0 };
    brandCounts.set(p.brand._id, { ...b, n: b.n + 1 });
  }
  for (const b of query.brand ?? []) if (!brandCounts.has(b)) brandCounts.set(b, { name: b, n: 0 });
  const selectedBrands = new Set(query.brand);

  const prices = (scope?.items ?? []).map((p) => p.price);
  const bounds = prices.length ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] : null;
  const clamp = (v: number | string | null | undefined, fallback: number) =>
    Math.min(bounds![1], Math.max(bounds![0], v == null ? fallback : Number(v)));

  const facet = ([k, f]: (typeof facets)[number]) => (
    <CheckList
      key={k}
      title={f.label}
      options={[...f.values].sort().map((v) => ({
        name: "spec",
        value: `${k}:${v}`,
        label: v === "true" ? "Oui" : v === "false" ? "Non" : v,
        checked: selectedSpecs.has(`${k}:${v}`),
      }))}
    />
  );

  const current = Math.floor((query.skip ?? 0) / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const count = `${page.total} produit${page.total > 1 ? "s" : ""} correspond${page.total > 1 ? "ent" : ""}`;
  const trail = category ? categoryTrail(categories, category) : [];
  const title = on_sale ? "Promos en cours" : "Tous nos produits";

  return (
    <main>
      {q && <TrackEvent event_type="search" search_query={q} />}
      {q ? (
        <SectionHeading as="h1" inner title={`Les résultats pour « ${q} »`} />
      ) : (
        <Breadcrumb
          h1
          items={
            trail.length
              ? trail.map((c) => ({ label: c.name, href: categoryHref(c) }))
              : [{ label: category ?? title }]
          }
        />
      )}

      <div className="bloc grid !p-0 lg:grid-cols-[323px_1fr]">
        <FilterSheet count={count}>
          <form id="filters" action="/produits" className="flex flex-col gap-5">
            <h2 id="filters-title" className="caps border-b-2 border-white pb-3 text-xl font-bold text-ldlc-price max-lg:sr-only">
              Filtrer les produits :
            </h2>

            {/* Tri en boutons radio dans la feuille mobile ; en desktop il reste envoyé tel quel avec les filtres. */}
            <fieldset className="lg:hidden">
              <legend className="mb-1 text-[15px] font-bold text-ldlc-strong">Trier par :</legend>
              {SORT_OPTIONS.map((o) => (
                <label key={o.value} className="flex min-h-11 items-center gap-3">
                  <input type="radio" name="sort" value={o.value} defaultChecked={(query.sort ?? "") === o.value} className="size-5 accent-ldlc-price" />
                  {o.label}
                </label>
              ))}
            </fieldset>

            <label>
              <span className={filterLabel}>Chercher une référence</span>
              <Input type="search" name="q" defaultValue={q ?? ""} placeholder="Désignation, modèle…" className="h-11 bg-white" />
            </label>

            <label>
              <span className={filterLabel}>Catégories</span>
              <select name="category" defaultValue={category ?? ""} className="h-11 w-full rounded-lg border border-border bg-white pr-9 pl-3">
                <option value="">Toutes</option>
                {flatten(categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {brandCounts.size > 0 && (
              <CheckList
                title="Marque"
                options={[...brandCounts].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, b]) => ({ name: "brand", value: id, label: b.name, count: b.n, checked: selectedBrands.has(id) }))}
              />
            )}

            {bounds && bounds[0] < bounds[1] && (
              <div>
                <span className={cn(filterLabel, "flex justify-between")}>
                  Prix <span className="normal-case italic text-muted-foreground">En €</span>
                </span>
                <PriceRange
                  key={`${bounds}-${query.min_price}-${query.max_price}`}
                  min={bounds[0]}
                  max={bounds[1]}
                  from={clamp(query.min_price, bounds[0])}
                  to={clamp(query.max_price, bounds[1])}
                />
              </div>
            )}

            <Toggle name="in_stock" checked={!!in_stock}>Voir uniquement les produits en stock</Toggle>
            <Toggle name="on_sale" checked={!!on_sale}>Voir uniquement les produits en promo</Toggle>

            {facets.slice(0, 2).map(facet)}
            {facets.length > 2 && (
              // Divulgation progressive : au-delà de deux, les filtres techniques s'ouvrent à la demande.
              <details className="group/more flex flex-col" open={facets.slice(2).some(([k]) => query.spec?.some((s) => s.startsWith(`${k}:`))) || undefined}>
                <summary className={buttonVariants({ variant: "outlineNavy", size: "pill", className: "mx-auto w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden" })}>
                  + de filtres <ChevronDown className="transition-transform group-open/more:rotate-180" aria-hidden />
                </summary>
                <div className="mt-5 flex flex-col gap-5">{facets.slice(2).map(facet)}</div>
              </details>
            )}
            {/* Specs déjà choisies mais absentes des facettes (page suivante, autre catégorie) : gardées. */}
            {query.spec
              ?.filter((s) => !facets.some(([k, f]) => s.startsWith(`${k}:`) && f.values.has(s.slice(k.length + 1))))
              .map((s) => <input key={s} type="hidden" name="spec" value={s} />)}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={withParams("/produits", {}, { category: category ?? undefined, q: q ?? undefined })} className={buttonVariants({ variant: "outlineDanger", size: "pill" })}>
                Réinitialiser
              </Link>
              <Button type="submit" variant="navy" size="pill" className="max-lg:hidden">
                Valider
              </Button>
            </div>
          </form>
        </FilterSheet>

        <section aria-labelledby="results-title" className="min-w-0 pb-6 max-lg:pb-24">
          <div className="flex flex-wrap items-center justify-between gap-4 px-[15px] py-5 lg:px-[30px]">
            <h2 id="results-title" className="caps tabular text-xl font-bold tracking-normal text-ldlc-text">
              {count}
            </h2>
            <span className="max-lg:hidden">
              <SortSelect sp={sp} value={query.sort} />
            </span>
          </div>
          {page.items.length ? (
            <ul className="stagger border-t border-border">
              {page.items.map((p) => (
                <ProductRow key={p._id} p={p} description={descriptions.get(p._id)} />
              ))}
            </ul>
          ) : (
            <p className="mx-[15px] rounded-lg border border-dashed p-8 text-center text-muted-foreground lg:mx-[30px]">
              Aucun produit ne correspond à ces filtres.
            </p>
          )}
          {pages > 1 && <Pagination sp={sp} current={current} pages={pages} />}
        </section>
      </div>
    </main>
  );
}

type Option = { name: string; value: string; label: string; count?: number; checked: boolean };

/** Liste déroulante à cases (« Sélectionner ▾ ») : divulgation native, compteur grisé, VALIDER en bas. */
function CheckList({ title, options }: { title: string; options: Option[] }) {
  const chosen = options.filter((o) => o.checked).map((o) => o.label);
  return (
    <details className="group" open={chosen.length > 0 || undefined}>
      <summary className="flex cursor-pointer list-none flex-col [&::-webkit-details-marker]:hidden">
        <span className={filterLabel}>{title}</span>
        <span className="flex h-11 items-center justify-between rounded-lg border border-border bg-white px-3 group-open:rounded-b-none">
          <span className={cn("truncate", !chosen.length && "text-muted-foreground italic")}>{chosen.join(", ") || "Sélectionner"}</span>
          <ChevronDown className="size-4 shrink-0 text-ldlc-price transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <fieldset className="rounded-b-lg border border-t-0 border-border bg-white px-3 py-1">
        <legend className="sr-only">{title}</legend>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name={o.name} value={o.value} defaultChecked={o.checked} className="size-4 accent-ldlc-price" />
            <span className="flex-1">{o.label}</span>
            {o.count != null && <span className="tabular text-muted-foreground italic">({o.count})</span>}
          </label>
        ))}
        <Button type="submit" variant="navy" size="pill" className="my-2 ml-auto flex max-lg:hidden">
          Valider
        </Button>
      </fieldset>
    </details>
  );
}

/** Interrupteur : vraie case à cocher (`role=switch`), piste dessinée à côté. */
function Toggle({ name, checked, children }: { name: string; checked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.8125rem]">
      <input type="checkbox" role="switch" name={name} value="true" defaultChecked={checked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-[oklch(70%_0_0)] transition-colors peer-checked:bg-ldlc-price peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
      {children}
    </label>
  );
}

/** Carrés collés de 44 px (40 mesurés, portés à la cible tactile) ; page courante bleu pâle, flèches seulement si utiles. */
function Pagination({ sp, current, pages }: { sp: SP; current: number; pages: number }) {
  const href = (n: number) => withParams("/produits", sp, { page: n > 1 ? String(n) : undefined });
  const cell = "tabular grid size-11 place-items-center text-base";
  return (
    <nav aria-label="Pagination" className="flex justify-center py-[35px]">
      <ul className="flex">
        {current > 1 && (
          <li>
            <Link href={href(current - 1)} className={cn(cell, "rounded-l-lg bg-background text-ldlc-text hover:bg-border")} aria-label="Page précédente">‹</Link>
          </li>
        )}
        {pageList(current, pages).map((n, i) => (
          <li key={i}>
            {n === "…" ? (
              <span className={cn(cell, "bg-background text-muted-foreground")}>…</span>
            ) : n === current ? (
              <span className={cn(cell, "bg-ldlc-pale font-bold text-primary")} aria-current="page">{n}</span>
            ) : (
              <Link href={href(n)} className={cn(cell, "bg-background text-muted-foreground hover:bg-border hover:text-ldlc-strong")} aria-label={`Page ${n}`}>{n}</Link>
            )}
          </li>
        ))}
        {current < pages && (
          <li>
            <Link href={href(current + 1)} className={cn(cell, "rounded-r-lg bg-background text-ldlc-text hover:bg-border")} aria-label="Page suivante">›</Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
