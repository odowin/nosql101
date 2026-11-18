import { Star } from "lucide-react";

/** 5 étoiles jaunes (arrondi à l'unité) + « N avis » ; rien sans avis. */
export function Stars({ avg, count }: { avg: number; count: number }) {
  if (!count) return <span className="text-xs text-muted-foreground">Pas encore d&apos;avis</span>;
  const full = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex" role="img" aria-label={`Note ${avg.toLocaleString("fr-FR")} sur 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`size-4 ${i < full ? "fill-ldlc-yellow text-ldlc-yellow" : "text-border"}`} aria-hidden />
        ))}
      </span>
      <span className="tabular text-[0.8125rem] font-bold text-ldlc-price">{count} avis</span>
    </span>
  );
}
