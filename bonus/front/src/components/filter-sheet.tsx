/** Colonne de filtres (bleu pâle, 323 px). */
export function FilterSheet({ children }: { count: React.ReactNode; children: React.ReactNode }) {
  return <aside aria-labelledby="filters-title" className="bg-ldlc-pale p-[22px] lg:rounded-tl-lg">{children}</aside>;
}
