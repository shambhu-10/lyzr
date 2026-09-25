import type { Plan } from "@/lib/types";
import { frameworkLabel } from "@/lib/catalog";
import { slug } from "./files";

export type BuildStep = {
  id: string;
  label: string; // Builder view: plain language
  dev: string; // Developer view: what actually happens
  ms: number;
  reveal?: number; // screen index that becomes visible when this step completes
  file?: string;
  terminal?: string[];
  diff?: { remove: string[]; add: string[] };
  fix?: boolean;
};

// ponytail: scripted build timeline; swap for real agent events (SSE) when code generation is live.
export function buildSteps(plan: Plan, framework = "lyzr"): BuildStep[] {
  const steps: BuildStep[] = [
    { id: "scaffold", label: "Setting up your project", dev: "scaffold next-app@16 · install dependencies", ms: 2600, terminal: ["$ architect scaffold --template next-agentic", "  ✓ created 42 files", "$ npm install", "  added 214 packages in 6.1s"] },
  ];
  if (plan.data.length)
    steps.push({ id: "db", label: "Creating a secure database", dev: "write supabase/migrations/0001_init.sql · enable RLS", ms: 1800, file: "supabase/migrations/0001_init.sql", terminal: ["$ supabase db push", "  ✓ applied 0001_init.sql (row-level security on)"] });
  plan.agents.forEach((a) =>
    steps.push({ id: `agent-${slug(a.name)}`, label: `Creating the ${a.name}`, dev: `write agents/${slug(a.name).replace(/-/g, "_")}.py (${frameworkLabel(framework)})`, ms: 2400, file: `agents/${slug(a.name).replace(/-/g, "_")}.py`, terminal: [`$ architect agents register ${slug(a.name)} --framework ${framework}`, "  ✓ registered · health check 200"] }),
  );
  plan.connections.forEach((c) =>
    steps.push({ id: `conn-${c.id}`, label: `Wiring up ${c.name}`, dev: `configure ${c.kind === "oauth" ? "oauth" : "secret"}: ${c.id}`, ms: 1400, terminal: [`  ✓ ${c.id} bound from vault (${c.kind === "oauth" ? "token" : "env var"})`] }),
  );
  plan.screens.forEach((s, i) => {
    steps.push({ id: `screen-${i}`, label: `Designing the “${s.name}” screen`, dev: `write app/${i === 0 ? "" : slug(s.name) + "/"}page.tsx`, ms: 3000, reveal: i, file: `app/${i === 0 ? "" : slug(s.name) + "/"}page.tsx` });
    if (i === 0)
      steps.push({
        id: "fix", fix: true, label: "Fixing a small issue (1/3) — free", dev: "✗ TypeError: prop mismatch in app/page.tsx → patch", ms: 2200,
        terminal: ["  ✗ TypeError: Cannot read properties of undefined (reading 'activeAgentId')", "  → self-fix attempt 1/3 (not billed)"],
        diff: { remove: ["<AgentStatus activeAgentId={activeAgentId} />"], add: ["<AgentStatus runningAgentId={activeAgentId} />"] },
      });
  });
  steps.push({ id: "verify", label: "Checking everything works", dev: "next build · runtime probe · route checks", ms: 2400, terminal: ["$ next build", "  ✓ compiled · 0 errors · 0 warnings", "$ probe /", "  ✓ GET / 200 (182ms)"] });
  return steps;
}

export type Check = { label: string; dev: string; ok: boolean | "warn"; fix?: string };

export function testChecks(plan: Plan, demo: boolean): Check[] {
  return [
    ...plan.screens.map((s) => ({ label: `“${s.name}” screen loads`, dev: `GET /${slug(s.name)} → 200`, ok: true as const })),
    ...plan.agents.map((a) => ({ label: `${a.name} responds with grounded output`, dev: `eval ${slug(a.name)}: 5/5 cases pass (groundedness ≥ 0.9)`, ok: true as const })),
    { label: "Works on a phone screen", dev: "viewport 375×812: no overflow", ok: true as const },
    demo
      ? { label: "Using sample data — real accounts not connected yet", dev: "connections: sample-mode", ok: "warn" as const, fix: "Connect now" }
      : { label: "Real accounts connected and reachable", dev: "connections: all healthy", ok: true as const },
  ];
}
