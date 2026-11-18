import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "LDLC NoSQL",
  description: "Catalogue, analytics et commandes de la refonte LDLC sur bases NoSQL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          Projet scolaire NoSQL — refonte LDLC
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
