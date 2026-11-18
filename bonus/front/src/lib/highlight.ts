/** Découpe `text` autour de chaque occurrence de `term` (casse ignorée) pour mettre le terme en gras. */
export function highlight(text: string, term: string): { text: string; match: boolean }[] {
  const t = term.trim();
  if (!t) return [{ text, match: false }];
  const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  // split avec un groupe capturant : les indices impairs sont les occurrences.
  return text
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((p) => p.text);
}
