import type { Plan } from "./types";

/**
 * Direct text edits from the preview ("Edit text" mode). Paths are whitelisted so a client can only change copy:
 *   s.<i>.name | s.<i>.purpose | s.<i>.b.<k>.(title|body|action) | s.<i>.b.<k>.items.<j>.(title|meta|badge) | s.<i>.b.<k>.fields.<j>.label
 */
const PATH = /^s\.(\d+)\.(?:(name|purpose)|b\.(\d+)\.(?:(title|body|action)|items\.(\d+)\.(title|meta|badge)|fields\.(\d+)\.(label)))$/;

export function applyTextEdit(plan: Plan, path: string, value: string): { plan: Plan; before: string } | null {
  const m = PATH.exec(path);
  if (!m) return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!text) return null;
  const next: Plan = structuredClone(plan);
  const s = next.screens[+m[1]];
  if (!s) return null;
  let before: string;
  if (m[2]) { const k = m[2] as "name" | "purpose"; before = s[k]; s[k] = text; return { plan: next, before }; }
  const b = s.blocks?.[+m[3]];
  if (!b) return null;
  if (m[4]) { const k = m[4] as "title" | "body" | "action"; before = b[k]; b[k] = text; }
  else if (m[5]) { const it = b.items[+m[5]]; if (!it) return null; const k = m[6] as "title" | "meta" | "badge"; before = it[k]; it[k] = text; }
  else { const f = b.fields[+m[7]]; if (!f) return null; before = f.label; f.label = text; }
  return { plan: next, before };
}
