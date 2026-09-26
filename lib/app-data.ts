/** Which table a form in a generated app saves into, and under which keys. Pure — tested in `npm run check`. */
export const colKey = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^[^a-z]+/, "").replace(/_+$/, "").slice(0, 40) || "value";

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, "")));

/** Best-matching table for a form: shared column names first, then words shared by the form title and the table name. */
export function pickTable(tables: { name: string; columns: { name: string }[] }[], keys: string[], title: string): string {
  if (!tables.length) return "submissions";
  const t = words(title);
  const score = (tb: (typeof tables)[number]) =>
    keys.filter((k) => tb.columns.some((c) => c.name === k)).length * 2 + [...words(tb.name.replace(/_/g, " "))].filter((w) => t.has(w)).length;
  return tables.reduce((best, tb) => (score(tb) > score(best) ? tb : best), tables[0]).name;
}
