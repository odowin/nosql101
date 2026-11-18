import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, LogOut, Package, ShoppingBag, Sparkles } from "lucide-react";
import { logout } from "@/app/actions";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { formatTtl } from "@/lib/format";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mon compte · LDLC NoSQL" };

const shortcuts = [
  { href: "/commandes", label: "Mes commandes", text: "Historique et détail (Cassandra)", icon: Package },
  { href: "/commandes#pour-vous", label: "Recommandations", text: "Clients aux achats proches (Neo4j)", icon: Sparkles },
  { href: "/panier", label: "Mon panier", text: "Conservé 30 jours (Redis)", icon: ShoppingBag },
];

export default async function AccountPage() {
  const session = await currentSession();
  const customer = session?.customer_id || undefined; // l'API renvoie "" pour une session anonyme
  if (!session || !customer) redirect("/connexion?retour=/compte");

  return (
    <main className="mx-auto w-full max-w-[1000px]">
      <SectionHeading as="h1" inner title="Mon compte" sub={`Bonjour ${customer}`} />

      <nav aria-label="Mon espace" className="bloc">
        <ul className="grid gap-4 md:grid-cols-3">
          {shortcuts.map(({ href, label, text, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex min-h-11 items-center gap-4 rounded-lg border-2 border-border p-4 transition-colors hover:border-primary active:bg-ldlc-pale"
              >
                <Icon className="size-8 shrink-0 text-ldlc-price" strokeWidth={1.5} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-bold text-ldlc-price">{label}</span>
                  <span className="text-xs text-muted-foreground">{text}</span>
                </span>
                <ChevronRight className="size-5 text-ldlc-price transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="session-title" className="bloc">
        <h2 id="session-title" className="caps mb-4 text-sm font-bold text-primary">
          Session en cours
        </h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Identifiant client</dt>
          <dd className="font-mono text-lg font-semibold text-ldlc-strong">{customer}</dd>
          <dt className="text-muted-foreground">Session restante</dt>
          <dd className="tabular">
            {formatTtl(session.ttl)}
            <span className="block text-sm text-muted-foreground">TTL glissant : chaque page vue le remet à 30 min.</span>
          </dd>
          <dt className="text-muted-foreground">Panier</dt>
          <dd className="font-mono text-sm">cart:{session.cart_id}</dd>
        </dl>
        <form action={logout} className="mt-6 flex flex-wrap items-center gap-4 border-t pt-6">
          <Button type="submit" variant="outlineNavy" size="pill">
            <LogOut aria-hidden /> Se déconnecter
          </Button>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            La session est supprimée ; votre panier reste dans Redis (30 jours) et revient à la prochaine connexion.
          </p>
        </form>
      </section>
    </main>
  );
}
