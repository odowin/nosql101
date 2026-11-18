"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/catalog-filters";
import { withParams } from "@/lib/format";

/** « Trier par : » ; changer de tri revient à la page 1 en gardant les filtres. */
export function SortSelect({ sp, value }: { sp: Record<string, string | string[] | undefined>; value?: string | null }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 text-sm whitespace-nowrap">
      Trier par :
      <select
        value={value ?? ""}
        onChange={(e) => router.push(withParams("/produits", sp, { sort: e.target.value || undefined, page: undefined }))}
        className="h-11 w-[190px] rounded-lg border border-border bg-white pr-9 pl-3 font-medium text-ldlc-strong"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
