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

// Secrets: round-trip, tamper detection.
process.env.SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");
import("../lib/secret-box").then(({ encryptSecret, decryptSecret }) => {
  const enc = encryptSecret("sk-live-123456");
  assert.equal(decryptSecret(enc), "sk-live-123456");
  assert.notEqual(enc.ciphertext, "sk-live-123456");
  assert.throws(() => decryptSecret({ ...enc, tag: Buffer.alloc(16).toString("base64") }));
  console.log("secrets ok");
});

// Security scan: catches a hardcoded key and a missing env var; clean code passes.
import { scan, secretOnLine } from "../lib/security-scan";
const fake = "gsk_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3";
const dirty = scan({ files: [{ path: "app/x.ts", content: `const k = "${fake}";\nfetch(process.env.STRIPE_KEY!)` }], plan: null, connections: {}, demo: false, vault: [] });
assert.equal(dirty[0].rule, "hardcoded-secret");
assert.equal(dirty[0].envName, "GROQ_API_KEY");
assert.ok(!dirty[0].excerpt!.includes(fake), "excerpt must be masked");
assert.ok(dirty.some((f) => f.rule === "missing-env" && f.envName === "STRIPE_KEY"));
assert.deepEqual(scan({ files: [{ path: "a.ts", content: "const k = process.env.GROQ_API_KEY;\nfetch(process.env.ARCHITECT_AGENT_URL!)" }], plan: null, connections: {}, demo: false, vault: ["GROQ_API_KEY"] }), []);
assert.equal(secretOnLine(`const apiKey = "your-key-here-123"`), null);
assert.equal(secretOnLine(`const apiKey = "a8f9s7df98a7sdf9"`)?.env, "API_KEY");
assert.equal(scan({ files: [], plan: null, connections: {}, demo: false, vault: [], agents: [{ name: "Mailer", tools: ["Send email"], instructions: "" }] })[0].rule, "agent-autonomy");
console.log("security scan ok");

// Themes: every enum maps to CSS variables.
import { ACCENTS, FONTS, RADII, SIDEBARS, themeStyle } from "../lib/theme";
for (const accent of Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]) for (const radius of Object.keys(RADII) as (keyof typeof RADII)[])
  for (const font of Object.keys(FONTS) as (keyof typeof FONTS)[]) for (const sidebar of SIDEBARS) {
    const st = themeStyle({ name: "t", why: "", accent, radius, font, sidebar }) as Record<string, string>;
    assert.ok(st["--a"] && st["--radius"] && st["--app-font"] && st["--app-side"]);
  }
console.log("themes ok");

// Click-to-edit: only whitelisted copy paths change.
import { applyTextEdit } from "../lib/plan-edit";
const blk = { type: "list" as const, title: "Inbox", body: "", items: [{ title: "Row", meta: "m", badge: "" }], columns: [], rows: [], fields: [{ label: "Name", kind: "text" as const, placeholder: "" }], action: "Save", agent: "A", source: "static" as const };
const ep = { ...plan, screens: [{ name: "Home", purpose: "p", blocks: [blk] }] };
assert.equal(applyTextEdit(ep, "s.0.b.0.title", "Tickets")!.plan.screens[0].blocks![0].title, "Tickets");
assert.equal(applyTextEdit(ep, "s.0.b.0.items.0.meta", "New")!.before, "m");
assert.equal(applyTextEdit(ep, "s.0.b.0.fields.0.label", "Email")!.plan.screens[0].blocks![0].fields[0].label, "Email");
assert.equal(applyTextEdit(ep, "s.0.b.0.agent", "Evil"), null);
assert.equal(applyTextEdit(ep, "s.0.b.0.source", "google-calendar"), null);
assert.equal(applyTextEdit(ep, "s.9.name", "x"), null);
assert.equal(applyTextEdit(ep, "s.0.name", "   "), null);
assert.equal(ep.screens[0].blocks[0].title, "Inbox", "original plan untouched");
console.log("text edits ok");
