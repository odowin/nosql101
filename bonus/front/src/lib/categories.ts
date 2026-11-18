import type { Category } from "./api/types";

/** Lien d'une catégorie. Les produits ne sont rattachés qu'aux feuilles (cpu, gpu…). */
export const categoryHref = (c: Category) =>
  // shortcut: une catégorie parente mène au catalogue entier, faute de page univers ; à pointer vers elle quand elle existera.
  c.children.length ? "/produits" : `/produits?category=${encodeURIComponent(c._id)}`;
