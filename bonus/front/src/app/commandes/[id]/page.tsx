import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ApiError, getOrder } from "@/lib/api/client";
import { formatDate, formatPrice, ORDER_STATUS as STATUS } from "@/lib/format";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Détail de commande · LDLC NoSQL" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const [order, session] = await Promise.all([
    getOrder(id).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
    currentSession(),
  ]);
  // L'API n'authentifie pas : on ne montre une commande qu'au client connecté qui l'a passée.
  if (!order || order.customer_id !== session?.customer_id) notFound();

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <Link href="/commandes" className="underline-offset-4 hover:underline">Mes commandes</Link> / {order.order_id}
      </nav>
      <header>
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
          Commande <span className="font-mono text-2xl">{order.order_id}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
          {formatDate(order.order_date)} <Badge variant="secondary">{STATUS[order.status] ?? order.status}</Badge>
          <Badge variant="outline">Cassandra</Badge>
        </p>
      </header>
      <table className="w-full text-sm">
        <caption className="sr-only">Articles de la commande</caption>
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 font-medium">Article</th>
            <th scope="col" className="py-2 text-right font-medium">Qté</th>
            <th scope="col" className="py-2 text-right font-medium">Prix unitaire</th>
            <th scope="col" className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="tabular divide-y">
          {order.items.map((i) => (
            <tr key={i.sku}>
              <td className="py-2">
                <Link href={`/produits/${encodeURIComponent(i.sku)}`} className="hover:text-primary">{i.name}</Link>
              </td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right">{formatPrice(i.unit_price)}</td>
              <td className="py-2 text-right">{formatPrice(i.unit_price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <th scope="row" colSpan={3} className="py-3 text-right">Total</th>
            <td className="tabular py-3 text-right text-lg font-bold">{formatPrice(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
