import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[65ch] py-16 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted-foreground">Ce produit ou cette page n&apos;existe pas (ou plus).</p>
      <Link href="/produits" className={buttonVariants({ className: "mt-6 min-h-11" })}>
        Retour au catalogue
      </Link>
    </main>
  );
}
