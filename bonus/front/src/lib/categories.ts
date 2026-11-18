import type { Category } from "./api/types";

/** Lien d'une catégorie : page univers si elle a des enfants, sinon liste produits (les produits ne sont rattachés qu'aux feuilles). */
export const categoryHref = (c: Category) =>
  c.children.length ? `/categories/${encodeURIComponent(c._id)}` : `/produits?category=${encodeURIComponent(c._id)}`;

/** Chemin racine → catégorie `id` dans l'arbre de GET /categories ; vide si inconnue. */
export function categoryTrail(tree: Category[], id: string): Category[] {
  for (const c of tree) {
    if (c._id === id) return [c];
    const sub = categoryTrail(c.children, id);
    if (sub.length) return [c, ...sub];
  }
  return [];
}
