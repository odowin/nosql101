import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Store, Truck } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { BuyBox } from "@/components/buy-box";
import { CategoryIcon } from "@/components/category-icon";
import { StockLabel } from "@/components/product-card";
import { Stars } from "@/components/stars";
import { RecoSection } from "@/components/reco-section";
import { ReviewForm } from "@/components/review-form";
import { TrackEvent } from "@/components/track-event";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getCategories, getDailyViews, getProduct, getRecommendations, listReviews } from "@/lib/api/client";
import { categoryHref, categoryTrail } from "@/lib/categories";
import { formatDate, priceParts, priceView, specSummary } from "@/lib/format";

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

const DELIVERY: Record<string, string> = {
  in_stock: "Livré après-demain",
  low_stock: "Livré sous 3 jours",
  preorder: "Expédié à réception",
};

const recos = [
  { kind: "compatible", title: "Compatibles" },
  { kind: "bought-together", title: "Souvent achetés ensemble" },
  { kind: "also-bought", title: "Ils ont aussi acheté" },
  { kind: "similar", title: "Produits similaires" },
] as const;

export default async function ProductPage({ params, searchParams }: Props) {
  const sku = decodeURIComponent((await params).sku);
  const page = Math.max(1, Math.trunc(Number((await searchParams).avis)) || 1);
  const [p, reviews, views, categories] = await Promise.all([
    loadProduct(sku),
    listReviews(sku, REVIEWS_PER_PAGE, (page - 1) * REVIEWS_PER_PAGE).catch(() => null),
    getDailyViews(sku, 1).then((d) => d[0]?.views ?? 0).catch(() => null),
    getCategories().catch(() => []),
  ]);
  const trail = categoryTrail(categories, p.category._id);
  const reviewPages = reviews ? Math.max(1, Math.ceil(reviews.total / REVIEWS_PER_PAGE)) : 1;
  const outOfStock = p.stock?.status === "out_of_stock";
  const v = priceView(p);
  const { units, cents } = priceParts(v.was ? p.effective_price : p.price);
  const delivery = DELIVERY[p.stock?.status ?? ""];

  return (
    <main className="flex flex-col gap-10">
      <TrackEvent event_type="product_view" sku={sku} />
      <Breadcrumb
        items={[
          // Sans arbre des catégories (API en erreur), seule la catégorie du produit reste.
          ...(trail.length
            ? trail.map((c) => ({ label: c.name, href: categoryHref(c) }))
            : [{ label: p.category.name, href: `/produits?category=${encodeURIComponent(p.category._id)}` }]),
          { label: p.name },
        ]}
      />

      <section className="bloc grid gap-[30px] lg:grid-cols-2" aria-label="Produit">
        {/* Galerie : pas de photo produit, placeholder neutre à ratio fixe avec le picto de la catégorie. */}
        <div className="grid aspect-square w-full max-w-[655px] place-items-center self-start justify-self-center bg-[oklch(95%_0_0)]" aria-hidden>
          <CategoryIcon id={p.category._id} className="size-1/3 text-[oklch(68%_0_0)]" />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-bold tracking-normal text-ldlc-text">{p.name}</h1>
            <h2 className="text-[13px] font-medium tracking-normal text-muted-foreground">
              {[p.brand.name, p.range, specSummary(p.specs ?? [])].filter(Boolean).join(" - ")}
            </h2>
            <a href="#avis" className="inline-flex min-h-11 w-fit items-center hover:underline">
              <Stars avg={p.rating.avg} count={p.rating.count} />
            </a>
          </div>

          {/* Encadré prix bleu pâle ; à droite, les vues du jour à la place du paiement fractionné (omis). */}
          <div className="tabular flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ldlc-pale px-5 py-4">
            <div className="flex flex-col gap-1">
              <span className="sr-only">Prix : {v.now}{v.was && `, au lieu de ${v.was}`}</span>
              <span aria-hidden className="text-[28px] leading-none font-bold whitespace-nowrap text-ldlc-price">
                {units}€<sup className="text-base font-bold">{cents}</sup>
              </span>
              {v.was && (
                <span aria-hidden className="flex items-center gap-2">
                  <del className="text-sm text-muted-foreground">{v.was}</del>
                  {v.badge && <Badge variant="promo">{v.badge}</Badge>}
                </span>
              )}
              {v.label && <span className="text-xs text-ldlc-text">{v.label} · {v.until}</span>}
            </div>
            <p className="text-xs text-ldlc-text lg:border-l lg:border-white lg:pl-4">
              {views === null ? "Vues du jour indisponibles" : `${views} vue${views > 1 ? "s" : ""} aujourd'hui`}
              <span className="block text-muted-foreground">Compteur Cassandra</span>
            </p>
          </div>

          {/* Disponibilité et livraison simulées d'après stock.status (pas de transporteur ni de boutiques). */}
          <div className="divide-y rounded-lg border border-border">
            <div className="flex min-h-[65px] flex-wrap items-center gap-3 px-4 py-2">
              <Truck className="size-6 shrink-0 text-ldlc-text" strokeWidth={1.5} aria-hidden />
              <div className="flex-1">
                <p className="font-bold text-ldlc-strong">Livraison à domicile ou en relais</p>
                {p.stock && <StockLabel status={p.stock.status} qty={p.stock.qty} />}
              </div>
              {delivery && <span className="rounded-[15px] bg-primary px-3 py-1 text-[13px] font-bold text-white">{delivery}</span>}
            </div>
            <div className="flex min-h-[65px] items-center gap-3 px-4 py-2">
              <Store className="size-6 shrink-0 text-ldlc-text" strokeWidth={1.5} aria-hidden />
              <p className="flex-1 font-bold text-ldlc-strong">Retrait en boutique</p>
              <span className="text-ldlc-price">Non disponible</span>
            </div>
          </div>

          <BuyBox sku={sku} maxQty={p.stock?.qty ?? 1} disabled={outOfStock} />
        </div>
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
