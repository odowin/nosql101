"use client";

import { useEffect } from "react";
import { trackEvent } from "@/app/actions";

type Event = Parameters<typeof trackEvent>[0];

/** Envoie l'événement une fois par valeur (vue produit ou recherche), sans rien afficher. */
export function TrackEvent(event: Event) {
  const key = JSON.stringify(event);
  useEffect(() => {
    void trackEvent(JSON.parse(key) as Event);
  }, [key]);
  return null;
}
