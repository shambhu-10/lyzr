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

// Tech spec: sanitizing, SQL per database, codegen per stack.
import { sanitizeTech, schemaSql, fallbackTech } from "../lib/tech-spec";
import { DEFAULT_STACK, toStack } from "../lib/catalog";
import { buildSteps as steps2 } from "../lib/script/build";
const spec = sanitizeTech({ tables: [
  { name: "Support Tickets!", purpose: "Tickets", access: "team", columns: [{ name: "id", type: "uuid" }, { name: "Subject", type: "text", nullable: false }, { name: "score", type: "float" }, { name: "subject", type: "text" }] },
  { name: "support tickets", columns: [] }, { name: "123", columns: [] },
] });
assert.equal(spec.tables.length, 1, "duplicate/invalid table names dropped");
assert.equal(spec.tables[0].name, "support_tickets");
assert.deepEqual(spec.tables[0].columns.map((c) => [c.name, c.type, c.nullable]), [["subject", "text", false], ["score", "text", true]], "reserved/duplicate columns dropped, unknown types → text");
const supa = schemaSql(spec, "supabase"), neonSql = schemaSql(spec, "neon"), lite = schemaSql(spec, "sqlite");
assert.ok(supa.includes("enable row level security") && supa.includes('"team can read"') && supa.includes("auth.uid()"));
assert.ok(!neonSql.includes("row level security") && neonSql.includes("gen_random_uuid()"));
assert.ok(lite.includes("CREATE TABLE support_tickets") && lite.includes("subject TEXT NOT NULL") && !lite.includes("uuid"));
assert.deepEqual(toStack({ frontend: "angular", database: "neon", model: "gpt-4" }), { ...DEFAULT_STACK, database: "neon" }, "unknown stack values fall back");
const screensPlan = { ...plan, screens: [{ name: "Inbox", purpose: "p" }, { name: "Reply Draft", purpose: "p" }], agents: [{ name: "Triage", role: "r", tools: [] }], data: ["tickets"] };
const nextFiles = filesFor(screensPlan, "lyzr", DEFAULT_STACK);
assert.ok(nextFiles.some((f) => f.path === "app/page.tsx" && f.role === "screen") && nextFiles.some((f) => f.path === "app/reply-draft/page.tsx" && f.role === "screen"));
assert.ok(nextFiles.some((f) => f.path === "supabase/migrations/0001_init.sql"));
const viteStack = toStack({ frontend: "vite", database: "neon", auth: "clerk", model: "qwen/qwen3.8-27b" });
const viteFiles = filesFor(screensPlan, "lyzr", viteStack);
assert.ok(viteFiles.some((f) => f.path === "src/pages/ReplyDraft.tsx" && f.role === "screen") && viteFiles.some((f) => f.path === "server/index.ts") && viteFiles.some((f) => f.path === "db/schema.sql"));
const pkg = JSON.parse(viteFiles.find((f) => f.path === "package.json")!.content);
assert.ok(pkg.dependencies["@neondatabase/serverless"] && pkg.dependencies["@clerk/clerk-react"] && pkg.devDependencies.vite && !pkg.dependencies.next);
assert.ok(viteFiles.find((f) => f.path === ".env.example")!.content.includes("DATABASE_URL="));
assert.ok(steps2(screensPlan, "lyzr", viteStack).some((s) => s.file === "src/pages/Inbox.tsx"));
assert.equal(fallbackTech([], DEFAULT_STACK).tables.length, 0);
// AGENTS.md with the new Stack / Data model sections still reads back.
const md2 = filesFor({ ...full, data: ["tickets"] }, "lyzr", viteStack).find((f) => f.path === "AGENTS.md")!.content;
assert.ok(md2.includes("## Stack") && md2.includes("## Data model"));
assert.deepEqual(parseAgentsMd(md2, full).warnings, []);
assert.deepEqual(parseAgentsMd(md2, full).plan.agents, full.agents);
// Agent projects: no screens, no screen steps, a trigger step, route instead of pages.
const agentPlan = { ...plan, screens: [], agents: [{ name: "Triage", role: "r", tools: [] }], trigger: { kind: "schedule" as const, detail: "8am" }, tests: [{ input: "a", expect: "b" }] };
const aSteps = steps2(agentPlan, "lyzr", DEFAULT_STACK);
assert.ok(!aSteps.some((s) => s.reveal !== undefined) && aSteps.some((s) => s.id === "trigger"));
const aFiles = filesFor(agentPlan, "lyzr", DEFAULT_STACK);
assert.ok(!aFiles.some((f) => f.role === "screen") && aFiles.some((f) => f.path === "app/api/agents/[agent]/route.ts"));
console.log("stack + tech spec + agent projects ok");
