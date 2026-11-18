import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getOrder } from "@/lib/api/client";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Commande confirmée · LDLC NoSQL" };

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const order = await getOrder(id).catch(() => null); // l'écriture Cassandra peut arriver juste après
  return (
    <main className="mx-auto flex max-w-[65ch] flex-col items-center gap-4 py-12 text-center">
      <CircleCheck className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <h1 className="text-3xl font-bold">Merci pour votre commande</h1>
      <p>
        Numéro de commande : <span className="font-mono font-semibold">{id}</span>
      </p>
      {order && (
        <p className="tabular text-muted-foreground">
          {order.items.length} article{order.items.length > 1 ? "s" : ""} · {formatPrice(order.total)}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/commandes/${encodeURIComponent(id)}`} className={buttonVariants({ className: "min-h-11 px-4" })}>
          Voir la commande
        </Link>
        <Link href="/produits" className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
          Continuer mes achats
        </Link>
      </div>
    </main>
  );
}
