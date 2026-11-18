/**
 * Titres de section LDLC. Par défaut (accueil) : « UNIVERS POPULAIRES  Tout ce que vous aimez est là », `action` à droite.
 * `inner` (pages internes, .title-1) : 26 px, gris, centré, terminé par « : ».
 */
export function SectionHeading({
  id,
  title,
  sub,
  action,
  inner,
  as: H = "h2",
}: {
  id?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  inner?: boolean;
  as?: "h1" | "h2";
}) {
  if (inner)
    return (
      <div className="mb-5 flex flex-col items-center gap-1 text-center">
        <H id={id} className="caps text-[1.625rem] font-bold text-muted-foreground">
          {title}&nbsp;:
        </H>
        {sub && <p className="text-muted-foreground italic">{sub}</p>}
        {action}
      </div>
    );
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <H id={id} className={`caps ${H === "h1" ? "text-[1.625rem]" : "text-xl"} font-bold text-foreground`}>
        {title}
      </H>
      {sub && <p className="text-muted-foreground italic">{sub}</p>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
