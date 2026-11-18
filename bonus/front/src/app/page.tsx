import Link from "next/link";
import { ChartNoAxesColumn, ChevronRight, LayoutGrid, Percent, Sparkles, ThumbsUp, UserRound, type LucideIcon } from "lucide-react";
import { Carousel } from "@/components/carousel";
import { FlashCard } from "@/components/flash-card";
import { HeroCarousel, type Slide } from "@/components/hero-carousel";
import { Newsletter } from "@/components/newsletter";
import { SectionHeading } from "@/components/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getTopProducts, listProducts } from "@/lib/api/client";
import type { Category, ProductSummary } from "@/lib/api/types";
import { formatPeriod } from "@/lib/format";
import { currentSession } from "@/lib/session";

const pill =
  "caps inline-flex min-h-11 items-center gap-1 rounded-full px-5 text-sm font-bold transition-[background-color,transform] active:translate-y-px";
const whitePill = `${pill} bg-white text-black hover:bg-white/85`;
const leaves = (cats: Category[]): Category[] => cats.flatMap((c) => (c.children.length ? leaves(c.children) : [c]));
const tile = "relative flex flex-col gap-4 overflow-hidden rounded-xl bg-header p-6 sm:p-8";
const more = (href: string) => (
  <Link href={href} className={buttonVariants({ variant: "info", size: "pill" })}>
    Voir + <ChevronRight className="size-3.5" aria-hidden />
  </Link>
);

/** Slide du hero : texte à gauche (titre serif bleu nuit, CTA pilule), visuel CSS à droite avec un grand arrondi bas-gauche. */
function SlideBody({ kicker, title, text, href, cta, icon: Icon, visual }: {
  kicker: string; title: string; text: string; href: string; cta: string; icon: LucideIcon; visual: string;
}) {
  return (
    <div className="surface-light grid min-h-[240px] md:min-h-[400px] md:grid-cols-2 lg:min-h-[466px]">
      <div className="flex flex-col items-start justify-center gap-4 p-6 md:p-12">
        <p className="caps rounded-[15px] bg-ldlc-night px-3 py-1 text-xs font-bold tracking-[0.1em] text-white">{kicker}</p>
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] font-extrabold text-ldlc-night">{title}</h2>
        <p className="max-w-[45ch] text-base text-ldlc-text max-md:hidden">{text}</p>
        <Link href={href} className={buttonVariants({ variant: "navy", size: "pill" })}>
          {cta} <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div aria-hidden className={`grid place-items-center rounded-bl-[160px] max-md:hidden ${visual}`}>
        <Icon className="size-40 text-white/85" strokeWidth={1} />
      </div>
    </div>
  );
}

function ProductCarousel({ label, items }: { label: string; items: ProductSummary[] }) {
  return (
    <Carousel label={label}>
      {items.map((p) => (
        <FlashCard key={p._id} p={p} className="w-[240px] shrink-0 snap-start lg:w-[260px]" />
      ))}
    </Carousel>
  );
}

export default async function Home() {
  const [top, promos, latest, categories, session] = await Promise.all([
    getTopProducts("day", 5).catch(() => null),
    listProducts({ on_sale: true, sort: "discount", limit: 10 }).catch(() => null),
    listProducts({ limit: 10 }).catch(() => null),
    getCategories().catch(() => []),
    currentSession(),
  ]);
  const promo = promos?.items.find((p) => p.promo)?.promo;
  const best = promos?.items[0]?.discount_percent;
  const customer = session?.customer_id || undefined;
  // Les produits ne sont rattachés qu'aux feuilles (cpu, gpu…) : filtrer sur une catégorie parente ne renvoie rien.
  const univers = leaves(categories);

  const slides: Slide[] = [
    {
      id: "promos",
      tab: "Promos",
      content: (
        <SlideBody
          kicker={promo ? formatPeriod(promo) : "Promos"}
          title={promo?.label ?? "Black Days"}
          text={`${promos?.total ?? 0} produits en promo${best ? `, jusqu'à −${best} %` : ""}. Prix recalculés à chaque lecture du catalogue.`}
          href="/promos"
          cta="Voir toutes les offres"
          icon={Percent}
          visual="hero-bg"
        />
      ),
    },
    {
      id: "top",
      tab: "Top des ventes",
      content: (
        <SlideBody
          kicker="Top des ventes"
          title={top?.items[0]?.name ?? "Les plus consultés"}
          text="Le classement des fiches les plus vues, recalculé chaque jour à partir des événements de navigation."
          href="/analytics"
          cta="Voir le classement"
          icon={ThumbsUp}
          visual="bg-[linear-gradient(135deg,oklch(45%_0.12_233),oklch(25%_0.1_263))]"
        />
      ),
    },
    {
      id: "nouveautes",
      tab: "Nouveautés",
      content: (
        <SlideBody
          kicker="Nouveautés"
          title="Les dernières références"
          text={`${latest?.total ?? 0} produits au catalogue, avec leurs caractéristiques techniques et les avis clients.`}
          href="/produits"
          cta="Tout le catalogue"
          icon={Sparkles}
          visual="bg-[linear-gradient(135deg,oklch(70%_0.15_61),oklch(45%_0.15_36))]"
        />
      ),
    },
    {
      id: "univers",
      tab: "Nos univers",
      content: (
        <SlideBody
          kicker="Univers"
          title="Composants, périphériques, logiciels"
          text={`${univers.length} rayons, du processeur au clavier.`}
          href={univers[0] ? `/produits?category=${encodeURIComponent(univers[0]._id)}` : "/produits"}
          cta="Parcourir les rayons"
          icon={LayoutGrid}
          visual="bg-[linear-gradient(135deg,oklch(55%_0.13_160),oklch(30%_0.07_200))]"
        />
      ),
    },
  ];

  return (
    <main className="theme-dark flex flex-col gap-10">
      <h1 className="sr-only">LDLC NoSQL : la boutique repensée sur quatre bases NoSQL</h1>

      <HeroCarousel slides={slides} />

      <ul className="stagger grid gap-4 lg:grid-cols-[2fr_1fr_1fr]" aria-label="À la une">
        <li className={`${tile} sm:flex-row sm:items-center`}>
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-3xl font-bold tracking-tight">{customer ? `Bonjour ${customer}` : "Votre compte"}</h2>
            <p className="max-w-[45ch] text-white/80">
              {customer
                ? "Session Redis active : retrouvez votre panier, vos commandes et vos recommandations."
                : "Connectez-vous avec un identifiant client : votre panier anonyme vous suit."}
            </p>
            <Link href="/compte" className={`${pill} self-start bg-primary text-primary-foreground hover:bg-primary/85`}>
              {customer ? "Gérer mon compte" : "Me connecter"} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <UserRound className="hidden size-28 shrink-0 text-link/60 sm:block" strokeWidth={1.25} aria-hidden />
        </li>
        <li className={`${tile} items-center text-center`}>
          <p className="caps text-xs font-semibold text-white/70">Lot 2 · Redis</p>
          <p className="flex flex-col leading-none">
            <span className="text-sm font-semibold">Panier client conservé</span>
            <span className="tabular mt-1 text-5xl font-black tracking-tight uppercase">30 jours</span>
            <span className="mt-2 text-sm text-white/70">session glissante de 30 min</span>
          </p>
          <Link href="/panier" className={`${whitePill} mt-auto`}>
            Voir mon panier <ChevronRight className="size-4" aria-hidden />
          </Link>
        </li>
        <li className={`${tile} items-center pt-0 text-center`}>
          <p className="caps rounded-b-lg bg-white px-4 py-1.5 text-xs font-bold text-black">Lot 3 · Cassandra</p>
          <ChartNoAxesColumn className="size-16 text-promo" strokeWidth={1.5} aria-hidden />
          <p className="text-xl font-bold tracking-tight">Vues et recherches du jour</p>
          <Link href="/analytics" className={`${whitePill} mt-auto`}>
            Voir les analytics <ChevronRight className="size-4" aria-hidden />
          </Link>
        </li>
      </ul>

      {univers.length > 0 && (
        <section aria-labelledby="univers" className="flex flex-col gap-4">
          <SectionHeading id="univers" title="Univers populaires" sub="Tout ce que vous aimez est là" />
          <ul className="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
            {univers.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/produits?category=${encodeURIComponent(c._id)}`}
                  className="surface-light flex min-h-20 items-center justify-center rounded-xl p-4 text-center transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 active:translate-y-0"
                >
                  <span className="text-lg">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {promos && promos.items.length > 0 && (
        <section aria-labelledby="promos" className="flex flex-col gap-4">
          <SectionHeading id="promos" title="Promos en cours" sub="Plus forte remise d'abord (MongoDB)" action={more("/promos")} />
          <ProductCarousel label="Promos en cours" items={promos.items} />
        </section>
      )}

      {latest && latest.items.length > 0 && (
        <section aria-labelledby="nouveautes" className="flex flex-col gap-4">
          <SectionHeading id="nouveautes" title="Nouveautés" sub="Les dernières références du catalogue" action={more("/produits")} />
          <ProductCarousel label="Nouveautés" items={latest.items} />
        </section>
      )}

      <section aria-labelledby="top" className="flex flex-col gap-4">
        <SectionHeading id="top" title="Top du jour" sub="Les fiches les plus vues aujourd'hui (Cassandra)" action={more("/analytics")} />
        {!top ? (
          <p className="text-sm text-muted-foreground">Classement indisponible pour le moment.</p>
        ) : top.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de vues aujourd&apos;hui : ouvrez quelques fiches produit.</p>
        ) : (
          <ol className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {top.items.map((i) => (
              <li key={i.sku} className="min-w-0">
                <Link
                  href={`/produits/${encodeURIComponent(i.sku)}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl bg-header p-4 transition-colors hover:bg-neutral-900 hover:text-link"
                >
                  <span className="tabular text-3xl font-black text-promo-text">{i.rank}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{i.name ?? i.sku}</span>
                    <span className="tabular text-sm text-muted-foreground">
                      {i.views} vue{i.views > 1 ? "s" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* « Nous rejoindre » : carte blanche en 2 colonnes séparées par un filet ; newsletter factice, sans réseaux sociaux. */}
      <section aria-labelledby="newsletter" className="surface-light grid gap-6 rounded-lg p-6 md:grid-cols-2 md:divide-x md:p-8">
        <div className="flex flex-col gap-2 md:pr-8">
          <h2 id="newsletter" className="font-serif text-[22px] font-extrabold tracking-normal text-ldlc-night">
            Restez informé
          </h2>
          <p className="text-muted-foreground">Les nouvelles promos et les nouveautés du catalogue.</p>
        </div>
        <div className="md:pl-8">
          <Newsletter />
        </div>
      </section>
    </main>
  );
}
