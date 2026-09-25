/** Line-level +/− counts between two texts (multiset comparison — good enough for a change summary). */
export function diffStats(a: string, b: string) {
  const count = (s: string) => s.split("\n").reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map<string, number>());
  const A = count(a), B = count(b);
  let added = 0, removed = 0;
  for (const [l, n] of B) added += Math.max(0, n - (A.get(l) ?? 0));
  for (const [l, n] of A) removed += Math.max(0, n - (B.get(l) ?? 0));
  return { added, removed };
}
