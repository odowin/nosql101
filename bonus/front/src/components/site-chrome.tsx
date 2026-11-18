"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Gabarit commun ; l'écran de connexion n'a qu'un en-tête bleu nuit de 60 px, sans navigation ni pied de page (SPEC §1). */
export function SiteChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const minimal = usePathname() === "/connexion";
  return (
    <>
      {minimal ? (
        <header className="bg-ldlc-night pt-[env(safe-area-inset-top)] text-white">
          <div className="px-safe mx-auto flex h-[60px] max-w-[1600px] items-center">
            <Link href="/" className="flex min-h-11 items-center gap-1.5 text-[1.75rem] font-black tracking-[-0.06em]">
              LDLC
              <span className="caps rounded-full bg-white px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.06em] text-black">NoSQL</span>
            </Link>
          </div>
        </header>
      ) : (
        header
      )}
      {children}
      {!minimal && footer}
    </>
  );
}
