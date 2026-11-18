"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { loginCustomer } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Connexion simulée par identifiant client : l'API fusionne le panier anonyme dans celui du client. */
export function LoginForm() {
  const [error, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    const r = await loginCustomer({ customer_id: String(fd.get("customer_id") ?? "") });
    if (!r.ok) return r.error;
    toast.success("Connecté : votre panier a été fusionné");
    return null;
  }, null);
  return (
    <form action={submit} className="flex flex-col gap-2">
      <label htmlFor="customer_id" className="text-sm font-medium">
        Identifiant client
      </label>
      <div className="flex gap-2">
        <Input
          id="customer_id"
          name="customer_id"
          required
          placeholder="C0001"
          pattern="[Cc][0-9]{4}"
          autoComplete="username"
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
          className="h-11 max-w-40 uppercase"
        />
        <Button type="submit" disabled={pending} className="min-h-11 px-4">
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
