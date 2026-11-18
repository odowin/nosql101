import Link from "next/link";
import { CircleHelp, Package, Percent, Search, ShoppingBag, Store, ThumbsUp, User } from "lucide-react";
import { CategoriesMenu } from "@/components/categories-menu";
import { getCart, getCategories } from "@/lib/api/client";
import { currentSession } from "@/lib/session";

// shortcut: Swagger joint sur le port publié par docker compose ; à passer en variable si l'API change d'adresse publique.
const SWAGGER = "http://localhost:8000/docs";

const navLinks = [
  { href: "/produits?on_sale=true", label: "Promos", icon: Percent },
  { href: "/analytics", label: "Meilleures ventes", icon: ThumbsUp },
  { href: "/commandes", label: "Commandes", icon: Package },
  { href: SWAGGER, label: "Aide", icon: CircleHelp },
];

const iconLink =
  "caps flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[0.7rem] text-white/85 transition-colors hover:text-white active:bg-white/10";

async function headerData() {
  const session = await currentSession();
  const cart = session ? await getCart(session.session_id).catch(() => null) : null; // session expirée ou API absente : panier vide
  return {
    customer: session?.customer_id || undefined, // l'API renvoie "" pour une session anonyme
    count: cart?.items.reduce((n, l) => n + l.quantity, 0) ?? 0,
    categories: await getCategories().catch(() => []),
  };
}

export async function SiteHeader() {
  const { customer, count, categories } = await headerData();
  return (
    <header className="bg-header text-white">
      <div className="px-safe mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:flex-nowrap">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-3xl font-black tracking-tighter">
          LDLC
          <span className="caps rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-black">NoSQL</span>
        </Link>

        <form action="/produits" role="search" className="relative order-last w-full lg:order-none lg:flex-1">
          <label htmlFor="site-search" className="sr-only">
            Rechercher dans le catalogue
          </label>
          <input
            id="site-search"
            type="search"
            name="q"
            placeholder="Chercher un produit, une marque, une catégorie"
            className="h-11 w-full rounded-lg bg-white pr-12 pl-4 text-base text-neutral-900 italic placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <button
            type="submit"
            aria-label="Rechercher"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-neutral-600 hover:text-neutral-900"
          >
            <Search className="size-5" aria-hidden />
          </button>
        </form>

        <nav aria-label="Espace client" className="ml-auto flex items-center gap-1">
          {/* Pas de boutiques physiques dans le projet : BOUTIQUES mène aux indicateurs de la boutique en ligne. */}
          <Link href="/analytics" className={iconLink}>
            <Store className="size-6" aria-hidden />
            <span className="max-sm:sr-only">Boutiques</span>
          </Link>
          <Link href="/compte" className={iconLink}>
            <span className="relative">
              <User className="size-6" aria-hidden />
              {customer && <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-header" />}
            </span>
            <span className="max-w-20 truncate max-sm:sr-only">{customer ?? "Compte"}</span>
            {customer && <span className="sr-only">, connecté</span>}
          </Link>
          <Link href="/panier" className={iconLink}>
            <span className="relative">
              <ShoppingBag className="size-6" aria-hidden />
              <span className="tabular absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-promo px-1 text-[0.65rem] leading-none font-bold tracking-normal text-promo-foreground">
                {count}
              </span>
            </span>
            <span className="max-sm:sr-only">Panier</span>
            <span className="sr-only">
              , {count} article{count > 1 ? "s" : ""}
            </span>
          </Link>
        </nav>
      </div>

      <nav aria-label="Navigation principale" className="px-safe mx-auto max-w-7xl">
        <ul className="-mb-px flex items-end gap-1 overflow-x-auto [scrollbar-width:none] lg:justify-between">
          <li className="shrink-0">
            <CategoriesMenu categories={categories} />
          </li>
          {navLinks.map(({ href, label, icon: Icon }) => (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className="caps inline-flex min-h-11 items-center gap-2 rounded-t-md px-3 text-sm whitespace-nowrap text-white/90 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
