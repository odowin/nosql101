import type { Metadata } from "next";
import { Montserrat, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

// Polices variables : toutes les graisses (500 à 800) sans fichier supplémentaire.
const montserrat = Montserrat({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-montserrat" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "LDLC NoSQL",
  description: "Catalogue, analytics et commandes de la refonte LDLC sur bases NoSQL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${sourceSerif.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
          {/* Contenu fluide, gouttières de 20 px, plafonné à 1600 px pour la lisibilité. */}
          <div className="px-safe mx-auto w-full max-w-[1600px] flex-1 pt-5 pb-8">{children}</div>
        </SiteChrome>
        <Toaster />
      </body>
    </html>
  );
}
