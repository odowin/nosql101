import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Chemin de retour après connexion : interne seulement (pas de « //hôte » ni « /\hôte », que le navigateur lit comme une URL externe). */
export const safeReturn = (path: string | string[] | undefined, fallback = "/compte") =>
  typeof path === "string" && /^\/(?![/\\])/.test(path) ? path : fallback;
