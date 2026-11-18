import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="grid gap-8 md:grid-cols-[16rem_1fr]" aria-busy="true" aria-label="Chargement du catalogue">
      <Skeleton className="h-9 w-48 md:col-span-2" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </ul>
    </main>
  );
}
