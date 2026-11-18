import {
  AppWindow, Box, CircuitBoard, Cpu, Fan, FileText, Gpu, HardDrive, Headphones, Keyboard,
  LayoutGrid, Monitor, MemoryStick, Mouse, PlugZap, type LucideIcon,
} from "lucide-react";

// Pas de visuel LDLC : un picto générique par catégorie (vignettes du méga-menu, placeholders produit).
const icons: Record<string, LucideIcon> = {
  informatique: Monitor, composants: Cpu, peripheriques: Keyboard, logiciels: AppWindow,
  cpu: Cpu, motherboard: CircuitBoard, ram: MemoryStick, gpu: Gpu, ssd: HardDrive, psu: PlugZap, case: Box, cooler: Fan,
  mouse: Mouse, keyboard: Keyboard, monitor: Monitor, headset: Headphones, os: AppWindow, office: FileText,
  // Préfixes de SKU qui diffèrent de l'id de catégorie (recos sans champ `category`, cf. skuCategory).
  hs: Headphones, kb: Keyboard, mb: CircuitBoard, mon: Monitor,
};

/** Catégorie d'une reco : son champ `category`, sinon le préfixe du SKU (« RAM-… » → ram). */
export const skuCategory = (r: { sku: string; category?: string }) => r.category ?? r.sku.split("-")[0].toLowerCase();

export function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const Icon = icons[id] ?? LayoutGrid;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
