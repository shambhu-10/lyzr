import type { Plan } from "@/lib/types";
import { estimate } from "@/lib/ai/estimate";

/**
 * Read an edited AGENTS.md back into the plan. We generate this format ourselves (lib/script/files.ts),
 * so parsing is deterministic; anything unrecognised is reported instead of guessed.
 */
export function parseAgentsMd(md: string, base: Plan): { plan: Plan; warnings: string[] } {
  const warnings: string[] = [];
  const lines = md.split("\n");
  const section = (title: RegExp) => {
    const start = lines.findIndex((l) => title.test(l));
    if (start === -1) return null;
    const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    return lines.slice(start + 1, end === -1 ? undefined : end).map((l) => l.trim()).filter(Boolean);
  };
  const name = lines.find((l) => /^# /.test(l))?.replace(/^# /, "").trim() || base.name;
  const firstH2 = lines.findIndex((l) => /^## /.test(l));
  const summary = lines.slice(lines.findIndex((l) => /^# /.test(l)) + 1, firstH2 === -1 ? undefined : firstH2).join(" ").replace(/\s+/g, " ").trim() || base.summary;

  const scopeLines = section(/^## Scope/i);
  const scope = scopeLines
    ? scopeLines.flatMap((l) => {
        const m = l.match(/^- \[( |x|X)\] (.+?)(?: —\s*(.*))?$/);
        if (!m) { warnings.push(`Scope line not understood: “${l}”`); return []; }
        return [{ item: m[2].trim(), status: m[1].trim() ? ("in" as const) : ("later" as const), reason: m[3]?.trim() ?? "" }];
      })
    : base.scope;

  const screenLines = section(/^## Screens/i);
  const screens = screenLines
    ? screenLines.flatMap((l) => {
        const m = l.match(/^- \*\*(.+?)\*\*(?: \(`[^`]*`\))?(?: —\s*(.*))?$/);
        if (!m) { warnings.push(`Screen line not understood: “${l}”`); return []; }
        const prev = base.screens.find((s) => s.name === m[1].trim());
        return [{ ...(prev ?? {}), name: m[1].trim(), purpose: m[2]?.trim() ?? prev?.purpose ?? "" }];
      })
    : base.screens;

  const agentLines = section(/^## Agents/i);
  const agents = agentLines
    ? agentLines.flatMap((l) => {
        const m = l.match(/^- \*\*(.+?)\*\*: (.+?)(?: \(tools: (.*)\))?$/);
        if (!m) { warnings.push(`Agent line not understood: “${l}”`); return []; }
        return [{ name: m[1].trim(), role: m[2].trim(), tools: m[3] ? m[3].split(",").map((t) => t.trim()).filter(Boolean) : [] }];
      })
    : base.agents;

  if (!screens.length) { warnings.push("The app needs at least one screen — keeping the previous screens."); screens.push(...base.screens); }
  if (!agents.length) { warnings.push("The app needs at least one agent — keeping the previous agents."); agents.push(...base.agents); }
  const plan: Plan = { ...base, name, summary, scope, screens, agents };
  return { plan: { ...plan, estimate: estimate(plan) }, warnings };
}
