"use client";

import { useState } from "react";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import type { Category } from "@/lib/api/types";

const href = (id: string) => `/produits?category=${encodeURIComponent(id)}`;

/** « Tous nos produits » : méga-menu des catégories (GET /categories), ouvert depuis le bouton. */
export function CategoriesMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false); // la navigation client ne ferme pas le popover d'elle-même
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="caps inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-md bg-primary px-4 text-sm text-primary-foreground transition-colors hover:bg-primary/85 active:bg-primary/75 data-popup-open:bg-primary/85">
        Tous nos produits
        <ChevronDown className="size-4 transition-transform in-data-popup-open:rotate-180" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={0} collisionPadding={16} className="z-50">
          <Popover.Popup className="max-h-[min(70dvh,32rem)] w-[min(calc(100vw-2rem),56rem)] origin-(--transform-origin) overflow-y-auto rounded-b-xl rounded-tr-xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="sr-only">Catégories</Popover.Title>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Catégories indisponibles.{" "}
                <Link href="/produits" onClick={close} className="text-link underline underline-offset-4">
                  Voir tout le catalogue
                </Link>
              </p>
            ) : (
              <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c, i) => (
                  <li
                    key={c._id}
                    className="animate-in fade-in slide-in-from-top-1 fill-mode-both duration-200"
                    style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  >
                    <Link href={href(c._id)} onClick={close} className="caps flex min-h-11 items-center text-sm text-foreground hover:text-link">
                      {c.name}
                    </Link>
                    {c.children.length > 0 && (
                      <ul className="border-l border-border pl-3">
                        {c.children.map((s) => (
                          <li key={s._id}>
                            <Link href={href(s._id)} onClick={close} className="flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/produits" onClick={close} className="caps mt-4 inline-flex min-h-11 items-center text-sm text-link hover:underline underline-offset-4">
              Tout le catalogue ›
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
