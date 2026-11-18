import Link from "next/link";
import { ShoppingCart } from "lucide-react";

const links = [
  { href: "/produits", label: "Catalogue" },
  { href: "/analytics", label: "Analytics" },
  { href: "/commandes", label: "Commandes" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto inline-flex min-h-11 items-center text-lg font-bold tracking-tight">
          LDLC <span className="ml-1 text-primary">NoSQL</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>
        {/* compteur placeholder, branché sur le panier plus tard */}
        <Link href="/panier" aria-label="Panier, 0 article" className="relative inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ShoppingCart className="size-5" aria-hidden />
          <span className="tabular absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
            0
          </span>
        </Link>
      </div>
    </header>
  );
}
