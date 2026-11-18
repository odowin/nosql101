"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginCustomer } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Connexion simulée par identifiant client : l'API fusionne le panier anonyme dans celui du client, puis on revient à `next`. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    const r = await loginCustomer({ customer_id: String(fd.get("customer_id") ?? "") });
    if (!r.ok) return r.error;
    toast.success("Connecté : votre panier a été fusionné");
    router.replace(next);
    return null;
  }, null);
  return (
    <form action={submit} className="flex w-full max-w-[300px] flex-col items-center gap-3">
      <label htmlFor="customer_id" className="sr-only">
        Identifiant client
      </label>
      <Input
        id="customer_id"
        name="customer_id"
        required
        placeholder="Votre identifiant client (ex. C0001)"
        pattern="[Cc][0-9]{4}"
        autoComplete="username"
        autoFocus
        aria-invalid={!!error}
        aria-describedby={error ? "login-error login-hint" : "login-hint"}
        className="rounded-none border-border bg-white"
      />
      <p id="login-hint" className="text-center text-xs text-muted-foreground">
        Connexion simulée : de C0001 à C9999, sans mot de passe.
      </p>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="navy" size="pill" disabled={pending}>
        {pending ? "Connexion…" : "Connexion"}
      </Button>
    </form>
  );
}
