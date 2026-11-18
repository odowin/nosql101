import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { StockLabel } from "@/components/product-card";
import { Price } from "@/components/price";
import { RecoSection } from "@/components/reco-section";
import { ReviewForm } from "@/components/review-form";
import { TrackEvent } from "@/components/track-event";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getDailyViews, getProduct, getRecommendations, listReviews } from "@/lib/api/client";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ sku: string }>; searchParams: Promise<{ avis?: string }> };

const REVIEWS_PER_PAGE = 5;

async function loadProduct(sku: string) {
  try {
    return await getProduct(sku);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sku } = await params;
  const p = await getProduct(decodeURIComponent(sku)).catch(() => null);
  return { title: `${p?.name ?? "Produit"} · LDLC NoSQL` };
}

const recos = [
  { kind: "compatible", title: "Compatibles" },
  { kind: "bought-together", title: "Souvent achetés ensemble" },
  { kind: "also-bought", title: "Ils ont aussi acheté" },
  { kind: "similar", title: "Produits similaires" },
] as const;

export default async function ProductPage({ params, searchParams }: Props) {
  const sku = decodeURIComponent((await params).sku);
  const page = Math.max(1, Math.trunc(Number((await searchParams).avis)) || 1);
  const [p, reviews, views] = await Promise.all([
    loadProduct(sku),
    listReviews(sku, REVIEWS_PER_PAGE, (page - 1) * REVIEWS_PER_PAGE).catch(() => null),
    getDailyViews(sku, 1).then((d) => d[0]?.views ?? 0).catch(() => null),
  ]);
  const reviewPages = reviews ? Math.max(1, Math.ceil(reviews.total / REVIEWS_PER_PAGE)) : 1;
  const outOfStock = p.stock?.status === "out_of_stock";

  return (
    <main className="flex flex-col gap-10">
      <TrackEvent event_type="product_view" sku={sku} />
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <Link href="/produits" className="underline-offset-4 hover:underline">Catalogue</Link> /{" "}
        <Link href={`/produits?category=${encodeURIComponent(p.category._id)}`} className="underline-offset-4 hover:underline">
          {p.category.name}
        </Link>
      </nav>

      <section className="grid gap-8 md:grid-cols-[1fr_20rem]">
        <div>
          <p className="text-sm text-muted-foreground">
            {p.brand.name}
            {p.range && ` · ${p.range}`} · <span className="font-mono">{p._id}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="tabular inline-flex items-center gap-1">
              <Star className="size-4 fill-current text-promo" aria-hidden />
              {p.rating.count ? `${p.rating.avg.toFixed(1)} / 5 (${p.rating.count} avis)` : "Pas encore d'avis"}
            </span>
            <Badge variant="outline">MongoDB · cache Redis</Badge>
          </p>
        </div>
        <aside className="flex flex-col gap-3 self-start rounded-lg bg-card p-5">
          <Price p={p} detailed className="text-3xl [&>span:first-child]:font-bold" />
          {p.stock && <StockLabel status={p.stock.status} qty={p.stock.qty} />}
          <AddToCart sku={sku} disabled={outOfStock} />
          <p className="tabular flex items-center justify-between gap-2 text-sm text-muted-foreground">
            {views === null ? "Vues du jour indisponibles" : `${views} vue${views > 1 ? "s" : ""} aujourd'hui`}
            <Badge variant="outline">Cassandra</Badge>
          </p>
        </aside>
      </section>

      {p.specs?.length > 0 && (
        <section aria-labelledby="specs">
          <SectionHeading id="specs" title="Caractéristiques" sub="Specs libres MongoDB" />
          <table className="mt-3 w-full max-w-2xl rounded-lg bg-card text-sm [&_td]:px-4 [&_th]:px-4">
            <tbody className="divide-y">
              {p.specs.map((s) => (
                <tr key={s.k}>
                  <th scope="row" className="w-1/2 py-2 pr-4 text-left font-medium text-muted-foreground">{s.label ?? s.k}</th>
                  <td className="tabular py-2">
                    {typeof s.v === "boolean" ? (s.v ? "Oui" : "Non") : String(s.v)}
                    {s.u && ` ${s.u}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="recos">
        <SectionHeading id="recos" title="Recommandations" sub="Graphe Neo4j" />
        <div className="stagger mt-3 grid gap-4 sm:grid-cols-2">
          {recos.map((r) => (
            <Suspense key={r.kind} fallback={<Skeleton className="h-72 rounded-xl" />}>
              <RecoSection title={r.title} items={getRecommendations(sku, r.kind)} />
            </Suspense>
          ))}
        </div>
      </section>

      <section id="avis" aria-label="Avis clients" className="scroll-mt-20">
        <SectionHeading title="Avis clients" sub="MongoDB" />
        {reviews === null ? (
          <p className="mt-2 text-muted-foreground">Avis indisponibles pour le moment.</p>
        ) : reviews.items.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Aucun avis pour l&apos;instant. Soyez le premier !</p>
        ) : (
          <ul className="mt-3 flex max-w-[65ch] flex-col gap-4">
            {reviews.items.map((r) => (
              <li key={r._id} className="border-b pb-4">
                <p className="tabular text-sm">
                  <span className="font-semibold text-link" aria-label={`Note ${r.rating} sur 5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span>
                  </span>{" "}
                  <span className="font-medium">{r.title}</span>
                </p>
                <p className="mt-1">{r.comment}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.author} · {formatDate(r.created_at)}
                  {r.verified_purchase && " · achat vérifié"}
                </p>
              </li>
            ))}
          </ul>
        )}
        {reviewPages > 1 && (
          <nav aria-label="Pages d'avis" className="mt-4 flex items-center gap-3">
            {page > 1 && (
              <Link href={`?avis=${page - 1}#avis`} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
                Avis précédents
              </Link>
            )}
            <span className="tabular text-sm text-muted-foreground">
              Page {page} sur {reviewPages}
            </span>
            {page < reviewPages && (
              <Link href={`?avis=${page + 1}#avis`} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
                Avis suivants
              </Link>
            )}
          </nav>
        )}
        <h3 className="mt-8 font-semibold">Donner votre avis</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Réservé aux clients connectés (connexion depuis le <Link href="/panier" className="underline underline-offset-4">panier</Link>).
        </p>
        <ReviewForm sku={sku} />
      </section>
    </main>
  );
}
