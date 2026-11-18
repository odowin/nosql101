"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Newsletter factice (SPEC §6) : aucun envoi ni stockage, le formulaire confirme seulement sur place. */
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Adresse e-mail
      </label>
      <div className="flex h-12 items-center rounded-[40px] border border-border bg-white pr-1 pl-4 focus-within:ring-2 focus-within:ring-ring">
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDone(false);
          }}
          placeholder="Votre adresse e-mail"
          className="min-w-0 flex-1 bg-transparent text-ldlc-strong outline-none"
        />
        <Button type="submit" variant="navy" size="pill" disabled={!email} className="h-10">
          OK
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm text-success">
        {done && "Merci ! (démo : aucune adresse n'est envoyée ni conservée)"}
      </p>
      <p className="text-[10px] text-muted-foreground">Projet scolaire : ce formulaire n&apos;envoie rien.</p>
    </form>
  );
}
