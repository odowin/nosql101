import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
import { Breadcrumb } from "@/components/breadcrumb";
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
    <main>
      <Breadcrumb
        items={[{ label: "Mon compte", href: "/compte" }, { label: "Mes commandes", href: "/commandes" }, { label: order.order_id }]}
      />
      <section aria-labelledby="order-title" className="bloc">
        <SectionHeading
          inner
          as="h1"
          id="order-title"
          title={
            <>
              Commande <span className="font-mono normal-case">{order.order_id}</span>
            </>
          }
          sub={`${formatDate(order.order_date)} · ${STATUS[order.status] ?? order.status} · Cassandra`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm [&_td]:px-4 [&_th]:px-4">
            <caption className="sr-only">Articles de la commande</caption>
            <thead className="caps text-left text-[0.8125rem] text-muted-foreground">
              <tr className="border-b-2">
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
                    <Link href={`/produits/${encodeURIComponent(i.sku)}`} className="inline-flex min-h-11 items-center font-bold text-ldlc-strong underline-offset-4 hover:underline">{i.name}</Link>
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
                <td className="tabular py-3 text-right text-lg font-bold text-ldlc-price">{formatPrice(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
