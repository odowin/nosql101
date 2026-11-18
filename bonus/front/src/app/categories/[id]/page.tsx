import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Carousel } from "@/components/carousel";
import { CategoryIcon } from "@/components/category-icon";
import { FlashCard } from "@/components/flash-card";
import { SectionHeading } from "@/components/section-heading";
import { getCategories, getProduct, getTopProducts } from "@/lib/api/client";
import { categoryHref, categoryTrail } from "@/lib/categories";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const trail = categoryTrail(await getCategories(), decodeURIComponent((await params).id));
  if (!trail.length) notFound();
  return trail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const node = (await load(params)).at(-1)!;
  return { title: `${node.name} · LDLC NoSQL` };
}

/** Page univers (niveau 1 ou 2) : bannière, puis tuiles des sous-catégories ; une feuille renvoie vers sa liste produits. */
export default async function CategoryPage({ params }: Props) {
  const trail = await load(params);
  const node = trail.at(-1)!;
  if (!node.children.length) redirect(categoryHref(node));
  // shortcut: l'API ne filtre pas le top par catégorie ; on lit les fiches du top 30 de la semaine et on garde celles de l'univers.
  const top = await getTopProducts("week", 30).catch(() => null);
  const best = (await Promise.allSettled((top?.items ?? []).map((t) => getProduct(t.sku))))
    .flatMap((r) => (r.status === "fulfilled" && r.value.category.path.split("/").includes(node._id) ? [r.value] : []))
    .slice(0, 10);

  return (
    <main>
      <Breadcrumb items={trail.map((c) => ({ label: c.name, href: categoryHref(c) }))} />

      {/* Bandeau neutre à la place de la bannière guide (pas de visuel LDLC). */}
      <section className="bloc grid items-center gap-6 overflow-hidden !p-0 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <h1 className="font-serif text-4xl font-extrabold tracking-tight text-ldlc-night">{node.name}</h1>
          <p className="text-ldlc-text">
            {node.children.length} sous-catégorie{node.children.length > 1 ? "s" : ""} à explorer
          </p>
        </div>
        <div
          aria-hidden
          className="hidden h-full min-h-40 place-items-center rounded-bl-[80px] bg-[radial-gradient(120%_120%_at_100%_0%,var(--ldlc-blue),var(--ldlc-night))] md:grid"
        >
          <CategoryIcon id={node._id} className="size-24 text-white/80" />
        </div>
      </section>

      <section className="bloc" aria-labelledby="sous-categories">
        <SectionHeading id="sous-categories" inner title={`Nos catégories ${node.name}`} />
        <ul className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {node.children.map((c) => (
            <li key={c._id} className="flex min-h-[94px] gap-4 border-2 border-border p-3 has-[details[open]]:border-ldlc-blue lg:min-h-[124px]">
              <span className="grid size-[70px] shrink-0 place-items-center bg-ldlc-alt lg:size-[100px]" aria-hidden>
                <CategoryIcon id={c._id} className="size-10 text-ldlc-text lg:size-12" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <Link href={categoryHref(c)} className="inline-flex min-h-11 items-center text-base font-bold text-ldlc-price underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                {c.children.length > 0 && (
                  <details className="group w-full">
                    <summary
                      className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden"
                      aria-label={`Sous-catégories ${c.name}`}
                    >
                      <span className="grid size-[30px] place-items-center rounded-full bg-border text-ldlc-price transition-colors group-open:bg-ldlc-price group-open:text-white">
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                      </span>
                    </summary>
                    <ul className="mt-1 flex flex-col text-sm text-ldlc-price">
                      {c.children.map((s) => (
                        <li key={s._id}>
                          <Link href={categoryHref(s)} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {best.length > 0 && (
        <section className="bloc" aria-labelledby="top-ventes">
          <SectionHeading id="top-ventes" inner title={`Top des ventes ${node.name}`} />
          <Carousel label={`Top des ventes ${node.name}`}>
            {best.map((p) => (
              <FlashCard key={p._id} p={p} className="w-[240px] shrink-0 snap-start ring-1 ring-border lg:w-[260px]" />
            ))}
          </Carousel>
        </section>
      )}
    </main>
  );
}
