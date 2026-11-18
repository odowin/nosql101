import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { RecoSection } from "@/components/reco-section";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerOrders, getCustomerRecommendations } from "@/lib/api/client";
import { formatDate, formatPrice, ORDER_STATUS as STATUS } from "@/lib/format";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mes commandes · LDLC NoSQL" };


export default async function OrdersPage() {
  const customer = (await currentSession())?.customer_id;
  if (!customer)
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 py-8">
        <SectionHeading as="h1" title="Mes commandes" />
        <p className="text-muted-foreground">Connectez-vous pour voir votre historique.</p>
        <LoginForm />
      </main>
    );

  const orders = await getCustomerOrders(customer);
  return (
    <main className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <header className="lg:col-span-2">
        <SectionHeading
          as="h1"
          title="Mes commandes"
          sub={
            <>
              Client <span className="font-mono not-italic">{customer}</span> · historique Cassandra
            </>
          }
        />
      </header>
      {orders.length ? (
        <ul className="divide-y self-start overflow-hidden rounded-xl bg-header ring-1 ring-white/10">
          {orders.map((o) => (
            <li key={o.order_id}>
              <Link href={`/commandes/${encodeURIComponent(o.order_id)}`} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-neutral-900 active:bg-neutral-800">
                <span className="font-mono text-sm font-semibold">{o.order_id}</span>
                <span className="text-sm text-muted-foreground">{formatDate(o.order_date)}</span>
                <Badge variant="secondary">{STATUS[o.status] ?? o.status}</Badge>
                <span className="tabular ml-auto font-semibold">{formatPrice(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Aucune commande pour l&apos;instant.</p>
      )}
      <div className="flex flex-col gap-2">
        <div id="pour-vous" className="scroll-mt-4">
          <SectionHeading title="Pour vous" sub="Neo4j" />
        </div>
        <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
          <RecoSection title="Clients aux achats proches" items={getCustomerRecommendations(customer)} />
        </Suspense>
      </div>
    </main>
  );
}
