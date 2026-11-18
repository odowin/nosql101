import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { LoginForm } from "@/components/login-form";
import { Badge } from "@/components/ui/badge";
import { getCart } from "@/lib/api/client";
import { currentSession, readSessionId } from "@/lib/session";

export const metadata: Metadata = { title: "Panier · LDLC NoSQL" };

export default async function CartPage() {
  const sid = await readSessionId();
  const [cart, session] = await Promise.all([sid ? getCart(sid).catch(() => null) : null, currentSession()]);
  return (
    <main className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <header className="lg:col-span-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          Panier <Badge variant="outline">Redis</Badge>
        </h1>
      </header>
      <CartView items={cart?.items ?? []} loggedIn={!!session?.customer_id} />
      <aside className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:self-start">
        <h2 className="font-semibold">Compte client</h2>
        {session?.customer_id ? (
          <p className="text-sm">
            Connecté en tant que <span className="font-mono font-semibold">{session.customer_id}</span>.
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
