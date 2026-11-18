import Link from "next/link";
import { Clock, Network, Tag } from "lucide-react";

// shortcut: Swagger joint sur le port publié par docker compose ; à passer en variable si l'API change d'adresse publique.
const SWAGGER = "http://localhost:8000/docs";

const columns = [
  {
    title: "Le projet",
    links: [
      { href: "/produits", label: "Lot 1 · Catalogue MongoDB" },
      { href: "/panier", label: "Lot 2 · Panier Redis" },
      { href: "/analytics", label: "Lot 3 · Analytics Cassandra" },
      { href: "/commandes", label: "Lot 4 · Recommandations Neo4j" },
    ],
  },
  {
    title: "Explorer",
    links: [
      { href: "/produits", label: "Tout le catalogue" },
      { href: "/promos", label: "Promos en cours" },
      { href: "/analytics", label: "Meilleures ventes" },
    ],
  },
  {
    title: "Mon espace",
    links: [
      { href: "/compte", label: "Compte" },
      { href: "/panier", label: "Panier" },
      { href: "/commandes", label: "Commandes" },
    ],
  },
  { title: "Documentation", links: [{ href: SWAGGER, label: "API (Swagger)" }] },
];

const assurances = [
  { icon: Clock, title: "Panier conservé", text: "Session Redis à durée de vie glissante de 30 minutes." },
  { icon: Tag, title: "Prix à jour", text: "Prix promo recalculés à chaque lecture du catalogue." },
  { icon: Network, title: "Recommandations", text: "Produits liés trouvés en parcourant le graphe Neo4j." },
];

/** Pied de page LDLC : 4 colonnes sur bleu nuit, bande de réassurance en 3 colonnes, mention du projet. */
export function SiteFooter() {
  return (
    <footer className="mt-12 bg-ldlc-night pt-10 text-[0.8125rem] text-ldlc-footer-link">
      <div className="px-safe mx-auto grid max-w-[1600px] gap-8 pb-10 max-lg:text-center sm:grid-cols-2 lg:grid-cols-4 lg:px-[30px]">
        {columns.map((c) => (
          <nav key={c.title} aria-labelledby={`footer-${c.title}`}>
            <h2
              id={`footer-${c.title}`}
              className="caps pb-3 text-sm font-bold text-white after:mt-3 after:block after:h-0.5 after:w-[50px] after:bg-white max-lg:after:mx-auto"
            >
              {c.title}
            </h2>
            <ul className="mt-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center hover:text-white hover:underline underline-offset-4 lg:min-h-[23px] lg:py-0.5">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <ul className="px-safe mx-auto grid max-w-[1600px] gap-8 border-t border-white/15 py-8 sm:grid-cols-3 lg:px-[30px]">
        {assurances.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-4 max-sm:flex-col max-sm:text-center">
            <Icon className="size-12 shrink-0 text-[oklch(72%_0.02_260)]" strokeWidth={1.25} aria-hidden />
            <div>
              <p className="caps text-[0.9375rem] font-bold text-white">{title}</p>
              <p className="text-sm text-pretty">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="px-safe flex flex-col items-center gap-2 border-t border-white/15 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <p className="flex items-center gap-1.5 text-3xl font-black tracking-[-0.06em] text-white">
          LDLC
          <span className="caps rounded-full bg-white px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.06em] text-ldlc-night">NoSQL</span>
        </p>
        <p className="max-w-[65ch]">Projet scolaire NoSQL — refonte LDLC. Site sans lien avec LDLC : aucune vente réelle.</p>
      </div>
    </footer>
  );
}
