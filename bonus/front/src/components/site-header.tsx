import { HeaderShell } from "@/components/header-shell";
import { getCart, getCategories } from "@/lib/api/client";
import { currentSession } from "@/lib/session";

/** Données de l'en-tête lues côté serveur ; la mise en page et le défilement sont gérés par HeaderShell. */
export async function SiteHeader() {
  const session = await currentSession();
  const [cart, categories] = await Promise.all([
    session ? getCart(session.session_id).catch(() => null) : null, // session expirée ou API absente : panier vide
    getCategories().catch(() => []),
  ]);
  return (
    <HeaderShell
      customer={session?.customer_id || undefined} // l'API renvoie "" pour une session anonyme
      count={cart?.items.reduce((n, l) => n + l.quantity, 0) ?? 0}
      categories={categories}
    />
  );
}
