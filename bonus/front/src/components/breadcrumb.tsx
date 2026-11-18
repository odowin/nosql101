import Link from "next/link";
import { House } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Fil d'Ariane LDLC : maison, liens 14/500 séparés par « › », dernier niveau en 700.
 * `h1` : le dernier niveau sert de titre de page (liste produits).
 * Mobile : une seule ligne (maison › parent › page tronquée) au lieu d'un empilement de niveaux.
 */
export function Breadcrumb({ items, h1 }: { items: Crumb[]; h1?: boolean }) {
  const last = items.at(-1);
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex items-center gap-x-1 text-sm sm:flex-wrap font-medium text-ldlc-text">
        <li className="shrink-0">
          <Link href="/" className="inline-grid size-11 place-items-center rounded-lg hover:text-primary" aria-label="Accueil">
            <House className="size-[22px]" strokeWidth={1.5} aria-hidden />
          </Link>
        </li>
        {items.map((c, i) => (
          <li
            key={c.href ?? c.label}
            className={cn("flex items-center gap-x-1", c === last ? "min-w-0" : "shrink-0", i < items.length - 2 && "max-sm:hidden")}
          >
            {c !== items[0] && <span aria-hidden className="text-[15px] text-muted-foreground">›</span>}
            {c === last ? (
              h1 ? (
                <h1 className="truncate text-sm font-bold tracking-normal text-ldlc-strong" aria-current="page">{c.label}</h1>
              ) : (
                <strong className="truncate font-bold text-ldlc-strong" aria-current="page">{c.label}</strong>
              )
            ) : (
              <Link href={c.href ?? "#"} className="inline-flex min-h-11 items-center px-1 underline-offset-4 hover:text-primary hover:underline">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
