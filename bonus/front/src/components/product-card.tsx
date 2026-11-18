// Libellés et couleurs de disponibilité, partagés par les lignes produit et la fiche.
export const STOCK: Record<string, [string, string]> = {
  in_stock: ["En stock", "text-success"],
  low_stock: ["Stock faible", "text-warning"],
  preorder: ["En précommande", "text-muted-foreground"],
  out_of_stock: ["Rupture de stock", "text-destructive"],
};

export function StockLabel({ status, qty }: { status: string; qty?: number }) {
  const [label, color] = STOCK[status] ?? [status, "text-muted-foreground"];
  return (
    <span className={`tabular text-sm ${color}`}>
      {label}
      {qty != null && status !== "out_of_stock" && ` (${qty})`}
    </span>
  );
}
