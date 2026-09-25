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
