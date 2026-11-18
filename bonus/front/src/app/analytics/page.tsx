import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDailyViews, getTopProducts, getTopSearches } from "@/lib/api/client";
import type { TopProducts } from "@/lib/api/types";
import { fillDays } from "@/lib/daily-views";

export const metadata: Metadata = { title: "Analytics · LDLC NoSQL" };

const PERIODS = [7, 14, 30];
const dayLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ sku?: string; days?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 7;
  const [today, week, searches] = await Promise.all([
    getTopProducts("day", 10).catch(() => null),
    getTopProducts("week", 10).catch(() => null),
    getTopSearches(10).catch(() => null),
  ]);
  const sku = sp.sku?.trim() || week?.items[0]?.sku;
  const series = sku ? await getDailyViews(sku, days).then((r) => fillDays(r, days)).catch(() => null) : null;
  const max = Math.max(1, ...(series ?? []).map((d) => d.views));

  return (
    <main className="flex flex-col gap-8">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          Analytics <Badge variant="outline">Cassandra</Badge>
        </h1>
        <p className="mt-1 max-w-[65ch] text-muted-foreground">
          Compteurs de vues et de recherches agrégés par jour, alimentés par les événements de navigation.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <TopTable title="Top produits du jour" data={today} />
        <TopTable title="Top produits de la semaine" data={week} />
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-semibold">Top recherches du jour</h2>
          {!searches ? (
            <Unavailable />
          ) : searches.length === 0 ? (
            <Empty />
          ) : (
            <ol className="mt-2 divide-y text-sm">
              {searches.map((s) => (
                <li key={s.search_query}>
                  <Link href={`/produits?q=${encodeURIComponent(s.search_query)}`} className="flex min-h-11 items-center justify-between gap-2 hover:text-link">
                    <span>{s.search_query}</span>
                    <span className="tabular text-muted-foreground">{s.searches}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="daily" className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 id="daily" className="font-semibold">Vues quotidiennes d&apos;un produit</h2>
        <form action="/analytics" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            SKU
            <Input name="sku" defaultValue={sku ?? ""} placeholder="CPU-AMD-R7-9700X" className="h-11 w-64 max-w-full font-mono" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Période
            <select name="days" defaultValue={days} className="h-11 rounded-lg border border-input bg-transparent px-2">
              {PERIODS.map((d) => (
                <option key={d} value={d}>
                  {d} jours
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11 px-4">
            Afficher
          </Button>
        </form>
        {!sku ? (
          <p className="mt-4 text-sm text-muted-foreground">Saisissez un SKU pour afficher sa courbe.</p>
        ) : !series ? (
          <Unavailable />
        ) : (
          <figure className="mt-6">
            <ol className="flex h-48 items-end gap-1" aria-label={`Vues par jour de ${sku}`}>
              {series.map((d) => (
                <li key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dayLabel.format(new Date(d.day))} : ${d.views} vues`}>
                  <span className="sr-only">
                    {dayLabel.format(new Date(d.day))} : {d.views} vues
                  </span>
                  <span className="tabular mb-1 text-center text-[0.65rem] text-muted-foreground" aria-hidden>
                    {days <= 14 ? d.views : ""}
                  </span>
                  <span className="rounded-t bg-primary" style={{ height: `${(d.views / max) * 85}%`, minHeight: d.views ? 2 : 0 }} aria-hidden />
                </li>
              ))}
            </ol>
            <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground" aria-hidden>
              <span>{dayLabel.format(new Date(series[0].day))}</span>
              <span>{dayLabel.format(new Date(series[series.length - 1].day))}</span>
            </figcaption>
          </figure>
        )}
      </section>
    </main>
  );
}

function TopTable({ title, data }: { title: string; data: TopProducts | null }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-semibold">{title}</h2>
      {!data ? (
        <Unavailable />
      ) : data.items.length === 0 ? (
        <Empty />
      ) : (
        <ol className="mt-2 divide-y text-sm">
          {data.items.map((i) => (
            <li key={i.sku}>
              <Link href={`/analytics?sku=${encodeURIComponent(i.sku)}`} className="flex min-h-11 items-center gap-2 hover:text-link">
                <span className="tabular w-5 text-muted-foreground">{i.rank}</span>
                <span className="min-w-0 flex-1 truncate">{i.name ?? i.sku}</span>
                <span className="tabular text-muted-foreground">{i.views}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const Unavailable = () => <p className="mt-2 text-sm text-muted-foreground">Données indisponibles pour le moment.</p>;
const Empty = () => <p className="mt-2 text-sm text-muted-foreground">Aucune donnée sur la période.</p>;
