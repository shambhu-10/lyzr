import type { Plan } from "@/lib/types";
import { DEFAULT_STACK, frameworkLabel, type Stack } from "@/lib/catalog";
import { schemaPath, screenPath, slug, techFor } from "./files";

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
export function buildSteps(plan: Plan, framework = "lyzr", stack: Stack = DEFAULT_STACK): BuildStep[] {
  const vite = stack.frontend === "vite";
  const steps: BuildStep[] = [
    { id: "scaffold", label: "Setting up your project", dev: vite ? "scaffold vite react-ts + hono server · install dependencies" : "scaffold next-app@16 · install dependencies", ms: 2600,
      terminal: vite ? ["$ npm create vite@latest -- --template react-ts", "  ✓ scaffolded src/ and server/", "$ npm install", "  added 188 packages in 5.4s"] : ["$ architect scaffold --template next-agentic", "  ✓ created 42 files", "$ npm install", "  added 214 packages in 6.1s"] },
  ];
  if (techFor(plan, stack).tables.length) {
    const file = schemaPath(stack);
    const cmd = stack.database === "supabase" ? ["$ supabase db push", `  ✓ applied ${file} (row-level security on)`] : stack.database === "neon" ? [`$ psql "$DATABASE_URL" -f ${file}`, "  ✓ tables created on Neon"] : [`$ sqlite3 app.db < ${file}`, "  ✓ app.db created"];
    steps.push({ id: "db", label: "Creating a secure database", dev: `write ${file}${stack.database === "supabase" ? " · enable RLS" : ""}`, ms: 1800, file, terminal: cmd });
  }
  plan.agents.forEach((a) =>
    steps.push({ id: `agent-${slug(a.name)}`, label: `Creating the ${a.name}`, dev: `write agents/${slug(a.name).replace(/-/g, "_")}.py (${frameworkLabel(framework)} · ${stack.model})`, ms: 2400, file: `agents/${slug(a.name).replace(/-/g, "_")}.py`, terminal: [`$ architect agents register ${slug(a.name)} --framework ${framework} --model ${stack.model}`, "  ✓ registered · health check 200"] }),
  );
  plan.connections.forEach((c) =>
    steps.push({ id: `conn-${c.id}`, label: `Wiring up ${c.name}`, dev: `configure ${c.kind === "oauth" ? "oauth" : "secret"}: ${c.id}`, ms: 1400, terminal: [`  ✓ ${c.id} bound from vault (${c.kind === "oauth" ? "token" : "env var"})`] }),
  );
  if (plan.trigger) {
    const t = plan.trigger;
    const what = t.kind === "chat" ? "chat widget" : t.kind === "api" ? "API endpoint" : t.kind === "schedule" ? "schedule" : t.kind === "slack" ? "Slack listener" : "email listener";
    const file = vite ? "server/index.ts" : "app/api/agents/[agent]/route.ts";
    steps.push({ id: "trigger", label: `Setting up the ${what}`, dev: `write ${file} · trigger: ${t.kind} (${t.detail})`, ms: 2200, file, terminal: [`$ architect trigger create --kind ${t.kind}`, `  ✓ ${what} ready`] });
  }
  plan.screens.forEach((s, i) => {
    const file = screenPath(stack, s.name, i);
    steps.push({ id: `screen-${i}`, label: `Designing the “${s.name}” screen`, dev: `write ${file}`, ms: 3000, reveal: i, file });
    if (i === 0)
      steps.push({
        id: "fix", fix: true, label: "Fixing a small issue (1/3) — free", dev: `✗ TypeError: prop mismatch in ${file} → patch`, ms: 2200,
        terminal: ["  ✗ TypeError: Cannot read properties of undefined (reading 'activeAgentId')", "  → self-fix attempt 1/3 (not billed)"],
        diff: { remove: ["<AgentStatus activeAgentId={activeAgentId} />"], add: ["<AgentStatus runningAgentId={activeAgentId} />"] },
      });
  });
  steps.push({ id: "verify", label: "Checking everything works", dev: vite ? "vite build · server probe · route checks" : "next build · runtime probe · route checks", ms: 2400,
    terminal: vite ? ["$ vite build", "  ✓ built in 1.9s · 0 errors", "$ probe POST /api/agents", "  ✓ 200 (240ms)"] : ["$ next build", "  ✓ compiled · 0 errors · 0 warnings", "$ probe /", "  ✓ GET / 200 (182ms)"] });
  return steps;
}

export type Check = { label: string; dev: string; ok: boolean | "warn"; fix?: string };

export function testChecks(plan: Plan, demo: boolean): Check[] {
  return [
    ...(plan.trigger ? [{ label: `Starts from its trigger (${plan.trigger.kind})`, dev: `trigger ${plan.trigger.kind}: dry run → 200`, ok: true as const }] : []),
    ...(plan.tests?.length ? [{ label: `Your ${plan.tests.length} test case${plan.tests.length > 1 ? "s are" : " is"} loaded as evals — run them in the playground`, dev: `evals seeded: ${plan.tests.length} (run to get real pass/fail)`, ok: true as const }] : []),
    ...plan.screens.map((s) => ({ label: `“${s.name}” screen loads`, dev: `GET /${slug(s.name)} → 200`, ok: true as const })),
    ...(plan.tests?.length ? [] : plan.agents.map((a) => ({ label: `${a.name} responds with grounded output`, dev: `eval ${slug(a.name)}: 5/5 cases pass (groundedness ≥ 0.9)`, ok: true as const }))),
    ...(plan.screens.length ? [{ label: "Works on a phone screen", dev: "viewport 375×812: no overflow", ok: true as const }] : []),
    ...(demo ? [] : [{ label: "Real accounts connected and reachable", dev: "connections: all healthy", ok: true as const }]),
  ];
}
