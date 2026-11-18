import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { RecoCarousel } from "@/components/reco-carousel";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerOrders, getCustomerRecommendations } from "@/lib/api/client";
import { formatDate, formatPrice, ORDER_STATUS as STATUS } from "@/lib/format";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mes commandes · LDLC NoSQL" };

export default async function OrdersPage() {
  const customer = (await currentSession())?.customer_id;
  if (!customer) redirect("/connexion?retour=/commandes");

  const orders = await getCustomerOrders(customer);
  return (
    <main>
      <Breadcrumb items={[{ label: "Mon compte", href: "/compte" }, { label: "Mes commandes" }]} />
      <section aria-labelledby="orders-title" className="bloc">
        <SectionHeading inner as="h1" id="orders-title" title="Mes commandes" sub={`Client ${customer} · historique Cassandra`} />
        {orders.length ? (
          <ul className="divide-y border-y">
            {orders.map((o) => (
              <li key={o.order_id}>
                <Link
                  href={`/commandes/${encodeURIComponent(o.order_id)}`}
                  className="group flex min-h-11 flex-wrap items-center gap-x-6 gap-y-1 px-2 py-4 transition-colors hover:bg-ldlc-alt active:bg-ldlc-pale"
                >
                  <span className="font-mono text-sm font-semibold text-ldlc-strong">{o.order_id}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(o.order_date)}</span>
                  <Badge variant="secondary" className="border-border">{STATUS[o.status] ?? o.status}</Badge>
                  <span className="tabular ml-auto text-base font-bold text-ldlc-price">{formatPrice(o.total)}</span>
                  <ChevronRight className="size-5 text-ldlc-price transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground">Aucune commande pour l&apos;instant.</p>
            <Link href="/promos" className={buttonVariants({ variant: "navy", size: "pill" })}>
              Voir les promos
            </Link>
          </div>
        )}
      </section>

      <section id="pour-vous" aria-labelledby="pour-vous-title" className="bloc scroll-mt-16">
        <SectionHeading inner id="pour-vous-title" title="Pour vous" sub="Clients aux achats proches (Neo4j)" />
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <RecoCarousel label="Recommandations pour vous" items={getCustomerRecommendations(customer)} />
        </Suspense>
      </section>
    </main>
  );
}
