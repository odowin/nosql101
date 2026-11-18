"use client";

import { useRef, useSyncExternalStore } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOBILE = "(width < 64rem)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(MOBILE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Colonne de filtres : `aside` dès 1024 px ; en dessous, feuille plein écran (`dialog` modal) ouverte par la barre
 * collante « Filtrer », avec « Appliquer » en bas. Le rendu serveur est l'aside, masqué en mobile : rien ne saute.
 */
export function FilterSheet({ count, children }: { count: React.ReactNode; children: React.ReactNode }) {
  const mobile = useSyncExternalStore(subscribe, () => matchMedia(MOBILE).matches, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const panel = "bg-ldlc-pale p-[22px] lg:rounded-tl-lg";

  if (!mobile) return <aside aria-labelledby="filters-title" className={`${panel} max-lg:hidden`}>{children}</aside>;
  return (
    <>
      <dialog ref={ref} aria-labelledby="filters-title" className="sheet m-0 size-full max-h-none max-w-none bg-white p-0 text-(--text)">
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between gap-2 py-2 pl-5 pr-[max(8px,env(safe-area-inset-right))]">
            <p className="flex items-center gap-2 text-xl font-bold text-ldlc-strong">
              <SlidersHorizontal aria-hidden /> Trier / Filtrer
            </p>
            <Button variant="ghost" size="icon" aria-label="Fermer" onClick={() => ref.current?.close()}>
              <X className="size-6" aria-hidden />
            </Button>
          </div>
          <div className={`${panel} flex-1`}>{children}</div>
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
            <span className="tabular text-sm font-bold">{count}</span>
            <Button type="submit" form="filters" variant="navy" size="pill">Appliquer</Button>
          </div>
        </div>
      </dialog>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-1px_4px_oklch(0%_0_0/10%)]">
        <span className="tabular text-sm font-bold">{count}</span>
        <Button variant="navy" size="pill" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>Filtrer</Button>
      </div>
    </>
  );
}
