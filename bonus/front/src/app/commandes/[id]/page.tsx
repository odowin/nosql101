import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
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
        <SectionHeading
          as="h1"
          title={
            <>
              Commande <span className="font-mono normal-case">{order.order_id}</span>
            </>
          }
          sub={`${formatDate(order.order_date)} · Cassandra`}
        />
        <Badge variant="secondary" className="mt-2">{STATUS[order.status] ?? order.status}</Badge>
      </header>
      <table className="w-full rounded-xl bg-header text-sm ring-1 ring-white/10 [&_td]:px-4 [&_th]:px-4">
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
                <Link href={`/produits/${encodeURIComponent(i.sku)}`} className="hover:text-link">{i.name}</Link>
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
