import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="max-w-[65ch] py-12">
      <h1 className="text-4xl font-bold">La boutique LDLC, repensée sur du NoSQL</h1>
      <p className="mt-4 text-muted-foreground">
        Parcourez le catalogue, suivez vos commandes et explorez les indicateurs analytiques.
      </p>
      <Link href="/catalogue" className={buttonVariants({ size: "lg", className: "mt-6 min-h-11" })}>
        Voir le catalogue
      </Link>
    </main>
  );
}
