import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { FlashCard } from "@/components/flash-card";
import { buttonVariants } from "@/components/ui/button";
import { listProducts } from "@/lib/api/client";

export const metadata: Metadata = { title: "Promos · LDLC NoSQL" };

/** Page promos façon « ventes flash » : produits en promo en cours (on_sale=true), plus forte remise d'abord. */
export default async function PromosPage() {
  // 100 = plafond de l'API ; le catalogue compte bien moins de promos.
  const page = await listProducts({ on_sale: true, sort: "discount", limit: 100 }).catch(() => null);

  return (
    <main>
      <Breadcrumb items={[{ label: "Promos" }]} />
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <p className="caps rounded-[15px] bg-ldlc-night px-3 py-1 text-xs font-bold tracking-[0.12em] text-white">Ventes flash</p>
        <h1 className="font-serif text-[clamp(2rem,5vw,2.5rem)] font-extrabold text-ldlc-night">Promos en cours</h1>
        <p className="tabular max-w-[65ch] text-ldlc-text">
          {page ? `${page.total} produit${page.total > 1 ? "s" : ""} en promo` : "Promos indisponibles pour le moment"}
          , plus forte remise d&apos;abord. Prix recalculés par l&apos;API à chaque lecture.
        </p>
      </header>

      {page && page.items.length > 0 ? (
        <ul className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {page.items.map((p) => (
            <FlashCard key={p._id} p={p} />
          ))}
        </ul>
      ) : (
        page && <p className="bloc text-center text-muted-foreground">Aucune promo en cours.</p>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/produits" className={buttonVariants({ variant: "outlineNavy", size: "pill" })}>
          Tout le catalogue <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </main>
  );
}
