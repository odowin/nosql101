"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { addReview } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const field = "flex flex-col gap-1.5 text-sm font-medium";

export function ReviewForm({ sku }: { sku: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [error, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    const r = await addReview({ sku, ...(Object.fromEntries(fd) as { author: string; rating: string; title: string; comment: string }) });
    if (!r.ok) return r.error;
    toast.success("Merci, votre avis est publié");
    form.current?.reset();
    return null;
  }, null);

  return (
    <form ref={form} action={submit} className="grid max-w-xl gap-4" aria-describedby={error ? "review-error" : undefined}>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className={field}>
          Nom affiché
          <Input name="author" required minLength={2} maxLength={60} autoComplete="nickname" className="h-11" />
        </label>
        <label className={field}>
          Note
          <select name="rating" defaultValue="5" className="h-11 rounded-lg border border-input bg-transparent pl-3 pr-9">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={field}>
        Titre
        <Input name="title" required minLength={3} maxLength={120} className="h-11" />
      </label>
      <label className={field}>
        Avis
        <textarea name="comment" required minLength={10} maxLength={2000} rows={4} className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-base md:text-sm" />
      </label>
      {error && (
        <p id="review-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="min-h-11 justify-self-start px-5">
        {pending ? "Envoi…" : "Publier l'avis"}
      </Button>
    </form>
  );
}
