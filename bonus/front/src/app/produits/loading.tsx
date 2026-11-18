import { Skeleton } from "@/components/ui/skeleton";

// Même gabarit que la liste : fil d'Ariane, colonne de filtres (desktop) et lignes de 160 px, pour que rien ne saute.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Chargement du catalogue">
      <Skeleton className="mb-4 h-11 w-64" />
      <div className="bloc grid !p-0 lg:grid-cols-[323px_1fr]">
        <div className="flex flex-col gap-5 rounded-tl-lg bg-ldlc-pale p-[22px] max-lg:hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 bg-white/70" />
          ))}
        </div>
        <ul className="flex flex-col gap-px p-[15px] lg:p-[30px]">
          <Skeleton className="mb-4 h-7 w-72" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-none" />
          ))}
        </ul>
      </div>
    </main>
  );
}
