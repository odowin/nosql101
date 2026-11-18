import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart-view";
import { LoginForm } from "@/components/login-form";
import { SectionHeading } from "@/components/section-heading";
import { getCart } from "@/lib/api/client";
import { currentSession, readSessionId } from "@/lib/session";

export const metadata: Metadata = { title: "Panier · LDLC NoSQL" };

export default async function CartPage() {
  const sid = await readSessionId();
  const [cart, session] = await Promise.all([sid ? getCart(sid).catch(() => null) : null, currentSession()]);
  return (
    <main className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <header className="lg:col-span-2">
        <SectionHeading as="h1" title="Panier" sub="Conservé dans Redis, durée de vie glissante" />
      </header>
      <CartView items={cart?.items ?? []} loggedIn={!!session?.customer_id} />
      <aside className="flex flex-col gap-3 rounded-xl bg-header p-5 ring-1 ring-white/10 lg:self-start">
        <h2 className="caps text-sm font-bold">Compte client</h2>
        {session?.customer_id ? (
          <p className="text-sm">
            Connecté en tant que <span className="font-mono font-semibold">{session.customer_id}</span>.{" "}
            <Link href="/compte" className="inline-flex min-h-11 items-center text-link underline-offset-4 hover:underline">
              Gérer mon compte
            </Link>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Connexion simulée : saisissez un identifiant (ex. C0001).</p>
            <LoginForm />
          </>
        )}
      </aside>
    </main>
  );
}
