import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getCart } from "@/lib/api/client";
import { currentSession, readSessionId } from "@/lib/session";

export const metadata: Metadata = { title: "Panier · LDLC NoSQL" };

// Le tunnel se limite au panier : « Passer commande » valide directement (livraison et paiement simulés).
const STEPS = ["Panier", "Livraison", "Paiement"];

export default async function CartPage() {
  const sid = await readSessionId();
  const [cart, session] = await Promise.all([sid ? getCart(sid).catch(() => null) : null, currentSession()]);
  return (
    // Place réservée à la barre collante du bas en mobile.
    <main className="pb-24 lg:pb-0">
      <nav aria-label="Étapes de commande" className="mb-5">
        <ol className="caps flex items-center justify-center gap-2 text-[0.8125rem] font-bold">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-muted-foreground">›</span>}
              <span
                aria-current={i === 0 ? "step" : undefined}
                className={i === 0 ? "flex items-center gap-2 text-primary" : "flex items-center gap-2 text-muted-foreground"}
              >
                <span
                  aria-hidden
                  className={`tabular grid size-7 place-items-center rounded-full ${i === 0 ? "bg-primary text-white" : "bg-border text-ldlc-text"}`}
                >
                  {i + 1}
                </span>
                {s}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <CartView items={cart?.items ?? []} loggedIn={!!session?.customer_id} />
    </main>
  );
}
