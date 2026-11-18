import { z } from "zod";

// Entrées utilisateur validées avant d'atteindre l'API (bornes alignées sur api/app/*.py).

const sku = z.string().trim().min(1, "Produit manquant").max(64);

export const addItemSchema = z.object({ sku, quantity: z.number().int().min(1).max(99) });
export const setQuantitySchema = z.object({ sku, quantity: z.number().int().min(0).max(99) });
export const skuSchema = z.object({ sku });

export const loginSchema = z.object({
  customer_id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^C\d{4}$/, "Identifiant client invalide (ex. C0001)"),
});

export const reviewSchema = z.object({
  sku,
  author: z.string().trim().min(2, "Nom trop court").max(60, "Nom trop long"),
  rating: z.coerce.number().int().min(1, "Note entre 1 et 5").max(5, "Note entre 1 et 5"),
  title: z.string().trim().min(3, "Titre trop court").max(120, "Titre trop long"),
  comment: z.string().trim().min(10, "Avis trop court (10 caractères minimum)").max(2000, "Avis trop long"),
});

export const eventSchema = z.discriminatedUnion("event_type", [
  z.object({ event_type: z.literal("product_view"), sku }),
  z.object({ event_type: z.literal("search"), search_query: z.string().trim().min(1).max(200) }),
]);

/** Premier message d'erreur, prêt à afficher. */
export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Saisie invalide";
