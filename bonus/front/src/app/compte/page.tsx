import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Package, Sparkles } from "lucide-react";
import { logout } from "@/app/actions";
import { LoginForm } from "@/components/login-form";
import { SectionHeading } from "@/components/section-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTtl } from "@/lib/format";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mon compte · LDLC NoSQL" };

const card = "flex flex-col gap-4 rounded-lg bg-card p-6";

export default async function AccountPage() {
  const session = await currentSession();
  const customer = session?.customer_id || undefined; // l'API renvoie "" pour une session anonyme

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <header>
        <SectionHeading as="h1" title="Mon compte" sub="Session Redis, durée de vie glissante" />
      </header>

      {session && customer ? (
        <>
          <section aria-labelledby="session-title" className={card}>
            <h2 id="session-title" className="caps text-sm text-muted-foreground">
              Session en cours
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Identifiant client</dt>
              <dd className="font-mono text-lg font-semibold">{customer}</dd>
              <dt className="text-muted-foreground">Session restante</dt>
              <dd className="tabular">
                {formatTtl(session.ttl)}
                <span className="block text-sm text-muted-foreground">TTL glissant : chaque page vue le remet à 30 min.</span>
              </dd>
              <dt className="text-muted-foreground">Panier</dt>
              <dd className="font-mono text-sm">cart:{session.cart_id}</dd>
            </dl>
          </section>

          <nav aria-label="Mon espace" className="grid gap-3 sm:grid-cols-2">
            <Link href="/commandes" className={buttonVariants({ variant: "secondary", size: "lg", className: "min-h-11 justify-start gap-2" })}>
              <Package aria-hidden /> Mes commandes
            </Link>
            <Link href="/commandes#pour-vous" className={buttonVariants({ variant: "secondary", size: "lg", className: "min-h-11 justify-start gap-2" })}>
              <Sparkles aria-hidden /> Recommandations pour moi
            </Link>
          </nav>

          <form action={logout} className={card}>
            <p className="max-w-[65ch] text-sm text-muted-foreground">
              La déconnexion supprime la session ; votre panier reste dans Redis (30 jours) et revient à la prochaine connexion.
            </p>
            <Button type="submit" variant="outline" className="min-h-11 self-start gap-2">
              <LogOut aria-hidden /> Se déconnecter
            </Button>
          </form>
        </>
      ) : (
        <section aria-labelledby="login-title" className={card}>
          <h2 id="login-title" className="text-xl font-semibold tracking-tight">
            Connexion
          </h2>
          <p className="max-w-[65ch] text-muted-foreground">
            Connexion simulée par identifiant client (C0001 à C9999). Les articles ajoutés en anonyme sont fusionnés dans le
            panier du client, qui est conservé 30 jours.
          </p>
          <LoginForm />
        </section>
      )}
    </main>
  );
}
