"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="mx-auto max-w-[65ch] py-16 text-center">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-muted-foreground">
        {error.message === "API injoignable"
          ? "L'API ne répond pas. Vérifiez que le service api tourne (port 8000)."
          : "Le chargement a échoué. Réessayez dans un instant."}
      </p>
      <Button onClick={reset} className="mt-6 min-h-11">
        Réessayer
      </Button>
    </main>
  );
}
