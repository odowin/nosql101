import Link from "next/link";

const lots = [
  { n: 1, db: "MongoDB", title: "Catalogue", href: "/produits" },
  { n: 2, db: "Redis", title: "Panier et sessions", href: "/panier" },
  { n: 3, db: "Cassandra", title: "Analytics et commandes", href: "/analytics" },
  { n: 4, db: "Neo4j", title: "Recommandations", href: "/commandes" },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 bg-header text-white/80">
      <div className="px-safe mx-auto grid max-w-7xl gap-8 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <nav aria-label="Les 4 lots">
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {lots.map((l) => (
              <li key={l.n}>
                <Link href={l.href} className="group flex min-h-11 flex-col justify-center rounded-md py-1">
                  <span className="caps text-xs text-white/60">
                    Lot {l.n} · {l.db}
                  </span>
                  <span className="text-white group-hover:text-link group-hover:underline underline-offset-4">{l.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t border-white/15 pt-6 text-sm text-white/60">
          Projet scolaire NoSQL — refonte LDLC. Site sans lien avec LDLC : aucune vente réelle.
        </p>
      </div>
    </footer>
  );
}
