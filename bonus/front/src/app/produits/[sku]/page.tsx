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
import { ProductTabs } from "@/components/product-tabs";
import { RecoSection } from "@/components/reco-section";
import { ReviewForm } from "@/components/review-form";
import { TrackEvent } from "@/components/track-event";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getCategories, getDailyViews, getProduct, getRecommendations, listReviews } from "@/lib/api/client";
import { categoryHref, categoryTrail } from "@/lib/categories";
import { formatDate, priceParts, priceView, ratingBreakdown, specSummary } from "@/lib/format";
import type { Spec } from "@/lib/api/types";

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

const specValue = (s: Spec) => `${typeof s.v === "boolean" ? (s.v ? "Oui" : "Non") : typeof s.v === "number" ? s.v.toLocaleString("fr-FR") : s.v}${s.u ? ` ${s.u}` : ""}`;

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
    // shortcut: au-delà de 100 avis, la répartition ne porte que sur les 100 plus récents ; ajouter un agrégat API si besoin.
    listReviews(sku, 100).catch(() => null),
    getDailyViews(sku, 1).then((d) => d[0]?.views ?? 0).catch(() => null),
    getCategories().catch(() => []),
  ]);
  const trail = categoryTrail(categories, p.category._id);
  const reviewPages = reviews ? Math.max(1, Math.ceil(reviews.items.length / REVIEWS_PER_PAGE)) : 1;
  const pageItems = reviews?.items.slice((page - 1) * REVIEWS_PER_PAGE, page * REVIEWS_PER_PAGE) ?? [];
  const outOfStock = p.stock?.status === "out_of_stock";
  const v = priceView(p);
  const { units, cents } = priceParts(v.was ? p.effective_price : p.price);
  const delivery = DELIVERY[p.stock?.status ?? ""];

  const general: [string, string][] = [
    ["Désignation", p.name],
    ["Marque", p.brand.name],
    ...(p.range ? [["Gamme", p.range] as [string, string]] : []),
    ["Catégorie", p.category.name],
    ["Référence", p._id],
  ];
  const groups: [string, [string, string][]][] = [
    ["Informations générales", general],
    ["Caractéristiques", (p.specs ?? []).map((s) => [s.label ?? s.k, specValue(s)])],
  ];

  // Pas de texte marketing en base : le descriptif est rédigé à partir des specs (MongoDB).
  const description = (
    <div className="flex max-w-[65ch] flex-col gap-3">
      <h3 className="font-serif text-2xl font-extrabold text-ldlc-night">{p.name}</h3>
      <p>
        {p.brand.name}
        {p.range && ` ${p.range}`}, rayon {p.category.name.toLowerCase()}.{" "}
        {p.specs?.length ? `${specSummary(p.specs, 99)}.` : ""}
      </p>
      <p className="text-xs text-muted-foreground">Fiche stockée dans MongoDB (specs libres), servie par le cache Redis.</p>
    </div>
  );

  const specsTable = (
    <table className="tabular w-full text-[13px] sm:table-fixed">
      <caption className="sr-only">Fiche technique</caption>
      {groups.map(([group, rows]) =>
        rows.length ? (
          <tbody key={group} className="border-t border-border">
            {/* Mobile : le groupe passe en ligne de titre au lieu de la colonne fusionnée. */}
            <tr className="sm:hidden">
              <th colSpan={2} scope="colgroup" className="caps pt-3 pb-1 text-left text-sm font-bold tracking-normal text-primary">{group}</th>
            </tr>
            {rows.map(([label, value], i) => (
              <tr key={label} className="border-b border-border">
                {i === 0 && (
                  <th scope="rowgroup" rowSpan={rows.length} className="caps w-1/4 py-1.5 pr-4 pl-2.5 text-left align-top text-sm font-bold tracking-normal text-primary max-sm:hidden">
                    {group}
                  </th>
                )}
                <th scope="row" className="w-1/3 py-1.5 pr-4 pl-1.5 text-left font-medium text-ldlc-text">{label}</th>
                <td className="py-1.5 pr-1.5 text-ldlc-strong">{value}</td>
              </tr>
            ))}
          </tbody>
        ) : null,
      )}
    </table>
  );

  const reviewsPanel =
    reviews === null ? (
      <p className="text-muted-foreground">Avis indisponibles pour le moment.</p>
    ) : (
      <div className="flex flex-col gap-6">
        {/* Synthèse : note sur 10 (avg sur 5 × 2), répartition calculée sur les avis chargés. */}
        <div className="tabular grid items-center gap-6 rounded-lg bg-ldlc-pale p-5 md:grid-cols-[180px_1fr_auto]">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="caps font-bold text-ldlc-strong">Note générale</p>
            <p className="font-bold text-primary">
              <span className="text-5xl leading-none">{(Math.round(p.rating.avg * 20) / 10).toLocaleString("fr-FR")}</span>
              <span className="text-xl">/10</span>
            </p>
            <Stars avg={p.rating.avg} count={p.rating.count} bare />
            <p className="text-ldlc-price">sur {reviews.total} avis</p>
          </div>
          <ul className="flex flex-col gap-1.5" aria-label="Répartition des notes">
            {ratingBreakdown(reviews.items.map((r) => r.rating)).map((b) => (
              <li key={b.stars} className="grid grid-cols-[auto_1fr_3rem_4rem] items-center gap-3">
                <Stars avg={b.stars} count={1} bare />
                <span className="h-1.5 rounded-full bg-[oklch(85%_0.05_220)]" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${b.pct}%` }} />
                </span>
                <span className="text-right text-lg text-ldlc-text">{b.pct}%</span>
                <span className="text-[13px] text-ldlc-text">{b.count ? `${b.count} avis` : ""}</span>
              </li>
            ))}
          </ul>
          <a href="#donner-avis" className={buttonVariants({ variant: "navy", size: "pill", className: "justify-self-center" })}>
            Donner votre avis ›
          </a>
        </div>

        {pageItems.length === 0 ? (
          <p className="text-muted-foreground">Aucun avis pour l&apos;instant. Soyez le premier !</p>
        ) : (
          <ul className="divide-y border-t border-border">
            {pageItems.map((r) => (
              <li key={r._id} className="grid gap-3 py-5 md:grid-cols-[290px_1fr]">
                <div className="text-[13px] text-muted-foreground">
                  <p className="text-sm font-bold text-ldlc-strong">par {r.author}</p>
                  <p>Publié le {formatDate(r.created_at)}</p>
                  {r.verified_purchase && <p>Achat vérifié</p>}
                </div>
                <div className="flex max-w-[75ch] flex-col gap-2">
                  <p className="flex flex-wrap items-center gap-3">
                    <Stars avg={r.rating} count={1} bare />
                    <span className="font-bold text-ldlc-strong">{r.title}</span>
                  </p>
                  <p className="leading-[1.7]">{r.comment}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {reviewPages > 1 && (
          <nav aria-label="Pages d'avis" className="flex items-center gap-3">
            {page > 1 && (
              <Link href={`?avis=${page - 1}#avis`} className={buttonVariants({ variant: "outlineNavy", size: "pill" })}>
                Avis précédents
              </Link>
            )}
            <span className="tabular text-sm text-muted-foreground">
              Page {page} sur {reviewPages}
            </span>
            {page < reviewPages && (
              <Link href={`?avis=${page + 1}#avis`} className={buttonVariants({ variant: "outlineNavy", size: "pill" })}>
                Avis suivants
              </Link>
            )}
          </nav>
        )}

        <div id="donner-avis" className="scroll-mt-24 border-t border-border pt-5">
          <h3 className="caps text-base font-bold text-ldlc-strong">Donner votre avis</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Réservé aux clients connectés (connexion depuis le <Link href="/panier" className="underline underline-offset-4">panier</Link>). Avis stockés dans MongoDB.
          </p>
          <ReviewForm sku={sku} />
        </div>
      </div>
    );

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

      <ProductTabs
        label="Informations produit"
        initial={page > 1 ? "avis" : undefined}
        tabs={[
          { id: "descriptif", title: "Descriptif", content: description },
          { id: "fiche-technique", title: "Fiche technique", content: specsTable },
          { id: "avis", title: `Avis clients${reviews ? ` (${reviews.total})` : ""}`, content: reviewsPanel },
        ]}
      />

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

    </main>
  );
}
