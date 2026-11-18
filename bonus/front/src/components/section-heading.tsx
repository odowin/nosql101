/** Titre de section façon « UNIVERS POPULAIRES  Tout ce que vous aimez est là » ; `action` se place à droite. */
export function SectionHeading({
  id,
  title,
  sub,
  action,
  as: H = "h2",
}: {
  id?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <H id={id} className={`${H === "h1" ? "text-3xl" : "text-xl sm:text-2xl"} font-bold tracking-tight uppercase`}>
        {title}
      </H>
      {sub && <p className="text-muted-foreground italic">{sub}</p>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
