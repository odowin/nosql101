import Link from "next/link";
import { ChartNoAxesColumn, ChevronRight, UserRound } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { getCategories, getTopProducts, listProducts } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { formatPeriod } from "@/lib/format";
import { currentSession } from "@/lib/session";

const pill =
  "caps inline-flex min-h-11 items-center gap-1 rounded-full px-5 text-sm font-bold transition-[background-color,transform] active:translate-y-px";
const whitePill = `${pill} bg-white text-black hover:bg-white/85`;
const leaves = (cats: Category[]): Category[] => cats.flatMap((c) => (c.children.length ? leaves(c.children) : [c]));
const tile = "relative flex flex-col gap-4 overflow-hidden rounded-xl bg-header p-6 sm:p-8";

export default async function Home() {
  const [top, promos, categories, session] = await Promise.all([
    getTopProducts("day", 5).catch(() => null),
    listProducts({ on_sale: true, limit: 8 }).catch(() => null),
    getCategories().catch(() => []),
    currentSession(),
  ]);
  // La bannière reprend la première promo en cours renvoyée par l'API ; sans promo, un titre générique.
  const promo = promos?.items.find((p) => p.promo)?.promo;
  const customer = session?.customer_id || undefined;
  // Les produits ne sont rattachés qu'aux feuilles (cpu, gpu…) : filtrer sur une catégorie parente ne renvoie rien.
  const univers = leaves(categories);

  const tabs = [
    { href: "/promos", label: promo?.label ?? "Black Days" },
    { href: "/analytics", label: "Les meilleures ventes" },
    { href: "/produits", label: "Tout le catalogue" },
    { href: "/panier", label: "Mon panier" },
    { href: "/commandes", label: "Mes commandes" },
  ];

  return (
    <main className="theme-dark flex flex-col gap-10">
      <h1 className="sr-only">LDLC NoSQL : la boutique repensée sur quatre bases NoSQL</h1>

      <section aria-labelledby="hero-title" className="overflow-hidden rounded-xl">
        <div className="hero-bg flex min-h-[20rem] flex-col items-center justify-center gap-6 px-6 py-12 text-center sm:min-h-[26rem]">
          {promo && (
            <p className="caps tabular rounded-md border-2 border-[oklch(0.8_0.09_195)] px-3 py-1 text-sm font-bold tracking-[0.18em] text-[oklch(0.9_0.05_195)]">
              {formatPeriod(promo)}
            </p>
          )}
          <h2
            id="hero-title"
            className="max-w-[12ch] text-[clamp(3rem,11vw,8.5rem)] leading-[0.9] font-black tracking-[-0.04em] uppercase [text-shadow:0_0_40px_oklch(0.8_0.09_195/35%)]"
          >
            {promo?.label ?? "Black Days"}
          </h2>
          <Link href="/promos" className={whitePill}>
            Voir toutes les offres <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <nav aria-label="Raccourcis" className="overflow-x-auto bg-white [scrollbar-width:thin]">
          <ul className="flex min-w-max divide-x divide-black/10 md:min-w-0">
            {tabs.map((t, i) => (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  className={`caps flex min-h-12 items-center justify-center px-5 text-sm whitespace-nowrap transition-colors ${
                    i === 0 ? "bg-header text-white hover:bg-neutral-800" : "text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

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
          <SectionHeading
            id="promos"
            title="Promos en cours"
            sub="Prix effectifs calculés par l'API (MongoDB)"
            action={
              <Link href="/promos" className="inline-flex min-h-11 items-center gap-1 text-sm text-link underline-offset-4 hover:underline">
                Toutes les promos <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {promos.items.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="top" className="flex flex-col gap-4">
        <SectionHeading id="top" title="Top du jour" sub="Les fiches les plus vues aujourd'hui (Cassandra)" />
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
    </main>
  );
}
