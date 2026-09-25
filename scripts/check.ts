// Quick self-checks for non-trivial pure logic. Run: npm run check
import assert from "node:assert";
import { balance, projectSpend, stageSpend } from "../lib/usage";
import { estimate } from "../lib/ai/estimate";
import { buildSteps } from "../lib/script/build";

const plan = { name: "X", tagline: "", summary: "", scope: [], data: [], estimate: { credits: 2, minutes: 10 },
  screens: [{ name: "A", purpose: "" }, { name: "B", purpose: "" }], agents: [{ name: "Agent", role: "r", tools: [] }], connections: [] };

assert.deepEqual(stageSpend({ stage: "plan", plan: null }), []);
assert.equal(projectSpend({ stage: "connect", plan }), 0.24);
assert.equal(projectSpend({ stage: "live", plan }), 2);
assert.equal(balance([{ stage: "live", plan }]), 18);
assert.deepEqual(estimate(plan), { credits: 1.22, minutes: 10 });
const steps = buildSteps(plan);
assert.equal(steps.filter((s) => s.reveal !== undefined).length, plan.screens.length, "every screen is revealed once");
assert.equal(steps.filter((s) => s.fix).length, 1, "exactly one free self-fix");
console.log("checks ok");

// AGENTS.md round-trip: what we generate, we can read back (and edits apply).
import { filesFor } from "../lib/script/files";
import { parseAgentsMd } from "../lib/agents-md";
const full = { ...plan, scope: [{ item: "Briefs", status: "in" as const, reason: "" }, { item: "Emails", status: "later" as const, reason: "v2" }], agents: [{ name: "Agent", role: "r", tools: ["Gmail"] }] };
const md = filesFor(full).find((f) => f.path === "AGENTS.md")!.content;
const back = parseAgentsMd(md, full);
assert.deepEqual(back.warnings, []);
assert.deepEqual(back.plan.scope, full.scope);
assert.deepEqual(back.plan.screens.map((s) => s.name), ["A", "B"]);
assert.deepEqual(back.plan.agents, full.agents);
const edited = parseAgentsMd(md.replace("- [ ] Emails — v2", "- [x] Emails").replace("**B**", "**Reports**"), full);
assert.equal(edited.plan.scope[1].status, "in");
assert.equal(edited.plan.screens[1].name, "Reports");
console.log("agents.md ok");

// Autocomplete overlap trimming.
import { trimOverlap } from "../components/workspace/code-panel";
assert.equal(trimOverlap("  const hours = ", "const hours = Math.floor(x)"), "Math.floor(x)");
assert.equal(trimOverlap("  return ", "value;"), "value;");
assert.equal(trimOverlap("", "foo()"), "foo()");
console.log("autocomplete ok");
