import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SectionHeading } from "@/components/section-heading";
import { currentSession } from "@/lib/session";
import { safeReturn } from "@/lib/utils";

export const metadata: Metadata = { title: "Identifiez-vous · LDLC NoSQL" };

const part = "flex flex-col items-center gap-5 px-5 py-8 text-center";
const title = "caps text-xl font-medium tracking-normal text-ldlc-text";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retour?: string | string[] }> }) {
  const next = safeReturn((await searchParams).retour);
  if ((await currentSession())?.customer_id) redirect(next);

  return (
    <main className="flex flex-col items-center">
      <SectionHeading as="h1" inner title="Identifiez-vous" />
      <div className="w-full max-w-[500px] divide-y rounded-lg bg-card">
        <section aria-labelledby="deja-client" className={part}>
          <h2 id="deja-client" className={title}>
            Déjà client ?
          </h2>
          <LoginForm next={next} />
        </section>
        <section aria-labelledby="nouveau-client" className={part}>
          <h2 id="nouveau-client" className={title}>
            Nouveau client ?
          </h2>
          {/* Pas de création de compte dans le projet : tout identifiant valide ouvre un compte de démo. */}
          <p className="max-w-[40ch] text-ldlc-text">
            Choisissez un identifiant libre : le compte est créé à la première connexion, avec votre panier anonyme.
          </p>
        </section>
      </div>
    </main>
  );
}
