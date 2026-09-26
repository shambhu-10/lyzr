import "server-only";
import { z } from "zod";
import { structured, type Usage } from "./llm";
import { INTEGRATIONS } from "@/lib/integrations";
import type { Block, Plan, Question, Screen } from "@/lib/types";
import { estimate } from "./estimate";
import { fallbackAgentPlan, fallbackBlocks, fallbackLooks, fallbackPlan, fallbackQuestions } from "./fallbacks";
import { ACCENTS, FONTS, RADII, SIDEBARS, type AppTheme } from "@/lib/theme";
import { ACCESS, COLUMN_TYPES, METHODS, fallbackTech, providedEnv, sanitizeTech, type TechSpec } from "@/lib/tech-spec";
import { stackLabel, type Stack } from "@/lib/catalog";

/* ---------------- schemas (Groq strict mode: every field required, empty values instead of optional) ---------------- */

const QuestionsSchema = z.object({
  intro: z.string().describe("One or two sentences: your understanding of the idea and the key decisions left open."),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    why: z.string().describe("One short line: why this choice changes what gets built"),
    multi: z.boolean().describe("true if several options can be chosen"),
    options: z.array(z.object({ label: z.string(), hint: z.string() })).min(2).max(4),
  })).min(2).max(4),
});

const BlockSchema = z.object({
  type: z.enum(["stats", "list", "table", "form", "detail", "text", "agent"]),
  title: z.string(),
  body: z.string().describe("text: the paragraph; agent: what the agent will do; otherwise empty"),
  items: z.array(z.object({ title: z.string(), meta: z.string(), badge: z.string() }))
    .describe("stats: label/value in title/meta; list: realistic rows; detail: label/value pairs; else empty"),
  columns: z.array(z.string()).describe("table only"),
  rows: z.array(z.array(z.string())).describe("table only: realistic rows, same length as columns"),
  fields: z.array(z.object({ label: z.string(), kind: z.enum(["text", "textarea", "select", "file"]), placeholder: z.string() })).describe("form only"),
  action: z.string().describe("button label for form/agent blocks, e.g. 'Generate brief'; else empty"),
  agent: z.string().describe("agent block: exact agent name from the plan; else empty"),
  source: z.enum(["static", "google-calendar", "selection"]).describe("google-calendar: list of the user's real meetings; selection: shows the item picked on a previous screen; else static"),
});

const ScreenSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).describe("0-3 realistic headline numbers; empty if none make sense"),
  rows: z.array(z.object({ title: z.string(), meta: z.string() })).describe("3-4 realistic sample items; empty for forms"),
  action: z.string().describe("Label of the main button on this screen"),
});

const PlanSchema = z.object({
  name: z.string().describe("Short memorable product name, 1-2 words"),
  tagline: z.string(),
  summary: z.string().describe("2-3 sentences, plain language, what the app does for whom"),
  scope: z.array(z.object({
    item: z.string(),
    status: z.enum(["in", "later"]),
    reason: z.string().describe("Why it is in v1 or deferred; empty string if in"),
  })).describe("EVERY capability the user asked for or chose, each marked in v1 or later. Never silently drop a request."),
  screens: z.array(ScreenSchema).min(2).max(5).describe("The main app screens. Skip login/sign-up — Architect adds authentication automatically."),
  agents: z.array(z.object({ name: z.string(), role: z.string(), tools: z.array(z.string()) })).min(1).max(4),
  data: z.array(z.string()).describe("What the app stores, plain language; empty if nothing"),
  connections: z.array(z.object({
    id: z.string().describe(`For OAuth use one of: ${INTEGRATIONS.map((i) => i.id).join(", ")}. For API keys use an ENV_VAR_NAME.`),
    name: z.string(),
    why: z.string().describe("Plain-language reason, e.g. 'to read your upcoming meetings'"),
    kind: z.enum(["oauth", "apikey"]),
  })).describe("Every EXTERNAL account or key the v1 features (status \"in\") need to work on real data — none for deferred items. Not the database, auth, hosting or AI model — Architect provides those."),
});

const AgentPlanSchema = PlanSchema.omit({ screens: true }).extend({
  trigger: z.object({ kind: z.enum(["chat", "api", "schedule", "slack", "email"]), detail: z.string().describe("Plain words, e.g. 'every weekday at 8:00' or 'when a message arrives in #support'") }),
  guardrails: z.array(z.string()).describe("2-4 things the agent must never do on its own, plain language"),
  tests: z.array(z.object({ input: z.string().describe("A realistic example input"), expect: z.string().describe("What a good answer must do, in one sentence") })).describe("2-4 test cases"),
});

// No min/max here: Groq strict mode strips them from the schema, so the model never sees them; sanitizeTech() bounds sizes.
const TechSchema = z.object({
  tables: z.array(z.object({
    name: z.string().describe("snake_case table name"),
    purpose: z.string(),
    access: z.enum(ACCESS).describe("owner: only the creator; team: any signed-in user can read; public_read: anyone can read"),
    columns: z.array(z.object({ name: z.string().describe("snake_case; do NOT include id, owner_id or created_at — they are added automatically"), type: z.enum(COLUMN_TYPES), nullable: z.boolean(), note: z.string() })),
  })).describe("Only what v1 needs to store; empty if the app stores nothing"),
  routes: z.array(z.object({ method: z.enum(METHODS), path: z.string().describe("starts with /api/"), purpose: z.string() })),
  env: z.array(z.object({ name: z.string().describe("UPPER_SNAKE"), purpose: z.string() })).describe("Only third-party keys the user must provide; not database/auth/agent-runtime vars"),
  notes: z.array(z.string()).describe("Short technical decisions and trade-offs worth knowing"),
});

const LooksSchema = z.object({
  looks: z.array(z.object({
    name: z.string().describe("Two-word name for the look, e.g. 'Calm Studio'"),
    why: z.string().describe("One short line on who or what this look suits, plain language"),
    accent: z.enum(Object.keys(ACCENTS) as [keyof typeof ACCENTS, ...(keyof typeof ACCENTS)[]]),
    radius: z.enum(Object.keys(RADII) as [keyof typeof RADII, ...(keyof typeof RADII)[]]),
    font: z.enum(Object.keys(FONTS) as [keyof typeof FONTS, ...(keyof typeof FONTS)[]]).describe("heading font: serif = elegant, sans = modern, mono = technical"),
    sidebar: z.enum(SIDEBARS),
  })).min(3).max(3),
});

const ScreenUISchema = z.object({ blocks: z.array(BlockSchema).min(2).max(5) });

const ChangeSchema = z.object({
  clarify: z.object({
    needed: z.boolean().describe("true ONLY if the request is too vague to apply well (e.g. 'make it better'); then leave screens unchanged"),
    question: z.string(),
    options: z.array(z.string()).describe("2-4 concrete interpretations, recommended first; empty if not needed"),
  }),
  summary: z.string().describe("One plain-language sentence a non-technical user understands, e.g. 'Made the brief shorter and added a copy button' — never mention blocks, fields or JSON"),
  changes: z.array(z.string()).describe("2-5 short bullets of what changed, naming screens, in plain words a non-technical user understands — never mention blocks, fields, meta or JSON"),
  screens: z.array(ScreenSchema.extend({ blocks: z.array(BlockSchema) })).describe("The full, updated list of screens with their blocks"),
});

const SYSTEM = `You are Architect, a product planner inside a platform that builds agentic web apps (Next.js UI + AI agents).
Audience: often non-technical business users; write in plain, warm, concise language. No jargon like "schema", "temperature", "manifest".
You design small, shippable v1s — but you are transparent: anything the user asked for that you defer must appear in scope with status "later" and a reason.
Identify every connection the app needs to work on real data (calendars, email, CRMs, API keys) so the user can connect them BEFORE building.
Architect itself provides the database, user sign-in, hosting and the AI model — never list those as connections.`;

const UI_SYSTEM = `You design screens for a web app as a short list of UI blocks. Use realistic, specific sample data (real-sounding names, numbers, dates) — never "Item 1" or lorem ipsum.
Rules: 2-5 blocks per screen. Put an "agent" block wherever an AI agent does work, with "agent" set to the exact agent name and "action" as the button label.
If the app connects Google Calendar and a screen lists meetings, use a "list" block with source "google-calendar" (still include 3-4 sample meetings as items).
A screen that works on something picked earlier (e.g. a selected meeting or email) should start with a "detail" block with source "selection".
Agents never send, post or delete on their own — label agent buttons with drafting verbs ("Draft reply", "Generate brief"), never "Send".
Keep titles short. Unused fields must be empty strings or empty arrays.`;

/* ---------------- public API ---------------- */

export type Step<T> = T & { live: boolean; usage: Usage[] };

export async function clarify(prompt: string, developer = false, opts: { kind?: "app" | "agent" | "import"; stack?: Stack; framework?: string } = {}): Promise<Step<{ intro: string; questions: Question[] }>> {
  const agent = opts.kind === "agent";
  const focus = agent
    ? "This is a standalone AI agent (no app screens). Ask about: how it is triggered (chat, API, schedule, Slack, email), which tools/data it uses, and what it may do on its own vs. what needs a human's approval."
    : "Ask about what most changes what gets built (e.g. which tools/ecosystem, which features in v1, whether to save data, who uses it).";
  const lens = developer
    ? `The user is a DEVELOPER. Ask 3-4 questions and make at least 2 of them technical, e.g. ${agent ? "tool-calling and API shape, memory/state between runs, rate limits and retries, how results are delivered" : "the data model (what entities and relations), roles and permissions, API/webhook needs, background jobs, environments"}. Technical terms are fine.${opts.stack ? ` They ALREADY chose: ${agent ? "" : stackLabel(opts.stack) + " · "}agents in ${opts.framework ?? "lyzr"} on ${opts.stack.model} — never ask about those again.` : ""}`
    : "The user is non-technical: ask 2-4 questions, with no technical jargon in questions or options.";
  const r = await structured(QuestionsSchema, "clarify", SYSTEM, `The user wants to build:\n"""${prompt}"""\n\nFirst reason about what is ambiguous or missing. ${focus} Put your recommended option FIRST (do not write "recommended" in labels — the UI marks it), and give every option a short hint.\n${lens}`, "medium");
  return r ? { ...r.data, live: true, usage: [r.usage] } : { ...fallbackQuestions(prompt), live: false, usage: [] };
}

export async function makePlan(prompt: string, answers: string, current?: Plan | null, instruction?: string, kind: "app" | "agent" | "import" = "app"): Promise<Step<Plan>> {
  const user = [
    `Original request:\n"""${prompt}"""`,
    answers && `User's answers to clarifying questions:\n${answers}`,
    current && `Current plan (JSON):\n${JSON.stringify({ ...current, screens: current.screens.map((s) => ({ name: s.name, purpose: s.purpose, metrics: s.metrics ?? [], rows: s.rows ?? [], action: s.action ?? "" })) })}`,
    instruction && `Revise the plan according to this instruction from the user: "${instruction}"`,
    kind === "agent" ? "This is a STANDALONE AGENT with no app screens: plan its trigger, tools, guardrails and test cases. Write the v1 plan." : "Write the v1 plan.",
  ].filter(Boolean).join("\n\n");
  if (kind === "agent") {
    const a = await structured(AgentPlanSchema, "agent_plan", SYSTEM, user, "medium");
    const plan: Omit<Plan, "estimate"> = a
      ? { ...a.data, screens: [], agents: a.data.agents.slice(0, 3), guardrails: a.data.guardrails.slice(0, 4), tests: a.data.tests.slice(0, 4) }
      : fallbackAgentPlan(prompt, current);
    return { ...plan, estimate: estimate(plan), live: !!a, usage: a ? [a.usage] : [] };
  }
  const r = await structured(PlanSchema, "plan", SYSTEM, user, "medium");
  const plan = r?.data ?? fallbackPlan(prompt, current, instruction);
  return { ...plan, estimate: estimate(plan), live: !!r, usage: r ? [r.usage] : [] };
}

/** Real "UI getting built": the model lays out one screen as blocks. */
export async function generateScreen(plan: Plan, i: number): Promise<Step<{ blocks: Block[] }>> {
  const { screens, ...rest } = plan;
  const r = await structured(ScreenUISchema, "screen", UI_SYSTEM,
    `App plan:\n${JSON.stringify({ ...rest, screens: screens.map((s) => ({ name: s.name, purpose: s.purpose })) })}\n\nDesign the screen "${screens[i].name}" — ${screens[i].purpose}.`, "low");
  return r ? { blocks: r.data.blocks, live: true, usage: [r.usage] } : { blocks: fallbackBlocks(plan, i), live: false, usage: [] };
}

/** Real post-build iteration: apply a change request to the app's screens and explain what changed. */
export async function changeApp(plan: Plan, instruction: string): Promise<Step<{ summary: string; changes: string[]; screens: Screen[]; clarify: { needed: boolean; question: string; options: string[] } }>> {
  const r = await structured(ChangeSchema, "change", `${UI_SYSTEM}\nYou are editing an existing app. Change only what the request needs; keep everything else identical.`,
    `Current app (JSON):\n${JSON.stringify({ name: plan.name, agents: plan.agents, connections: plan.connections, screens: plan.screens })}\n\nChange request: "${instruction}"`, "medium");
  if (r) return { ...r.data, live: true, usage: [r.usage] };
  return { summary: "I couldn't apply that change right now — your app is unchanged.", changes: [], screens: plan.screens, clarify: { needed: false, question: "", options: [] }, live: false, usage: [] };
}

const KindSchema = z.object({ kind: z.enum(["app", "agent"]), reason: z.string() });

/** App (screens people use) or standalone agent (runs from a trigger, no UI of its own)? Used when the user didn't choose. */
export async function detectKind(prompt: string): Promise<Step<{ kind: "app" | "agent" }>> {
  const r = await structured(KindSchema, "kind", "Classify a build request. APP = something with screens people open and use (dashboard, portal, tracker, form, CRM). AGENT = a standalone AI worker with no UI of its own that runs from a trigger (chat message, API call, schedule, Slack, email) — e.g. 'an agent that triages my inbox every morning'. If both, choose app.",
    `Request:\n"""${prompt}"""`, "low");
  if (r) return { kind: r.data.kind, live: true, usage: [r.usage] };
  const agentish = /\b(agent|bot|assistant)\b/i.test(prompt) && !/\b(app|dashboard|screen|portal|page|tracker|crm)\b/i.test(prompt);
  return { kind: agentish ? "agent" : "app", live: false, usage: [] };
}

const SeedSchema = z.object({
  tables: z.array(z.object({ name: z.string(), rows: z.array(z.object({ values: z.array(z.object({ column: z.string(), value: z.string() })) })) })),
});

/** A few realistic example rows per table, so the first build's Data tab isn't empty (marked "example" in the UI). */
export async function makeSeedRows(plan: Plan, tables: TechSpec["tables"]): Promise<Step<{ rows: { table: string; data: Record<string, string> }[] }>> {
  if (!tables.length) return { rows: [], live: false, usage: [] };
  const r = await structured(SeedSchema, "seed", "You write realistic example database rows for a new app. Specific, believable values (real-sounding names, dates, amounts). 3 rows per table. Use exactly the given column names.",
    `App: ${plan.name} — ${plan.summary}\nTables:\n${tables.map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}`).join(", ")})`).join("\n")}`, "low");
  if (!r) return { rows: [], live: false, usage: [] };
  const rows = r.data.tables.flatMap((t) => {
    const tb = tables.find((x) => x.name === t.name);
    if (!tb) return [];
    return t.rows.slice(0, 5).map((row) => ({ table: tb.name, data: Object.fromEntries(row.values.filter((v) => tb.columns.some((c) => c.name === v.column)).map((v) => [v.column, v.value.slice(0, 500)])) }));
  });
  return { rows, live: true, usage: [r.usage] };
}

/** Developer view of the plan: data model, API routes and env, fitted to the chosen stack. */
export async function makeTechSpec(plan: Plan, stack: Stack, framework: string): Promise<Step<{ tech: TechSpec }>> {
  const r = await structured(TechSchema, "tech", "You are a senior full-stack engineer writing a concise technical spec for a v1. Be concrete and minimal: only tables, routes and keys the plan needs. Use snake_case for tables and columns.",
    `Stack: ${stackLabel(stack)} · agents in ${framework} on ${stack.model}.\nApp plan:\n${JSON.stringify({ name: plan.name, summary: plan.summary, scope: plan.scope.filter((s) => s.status === "in").map((s) => s.item), screens: plan.screens.map((s) => ({ name: s.name, purpose: s.purpose })), agents: plan.agents, data: plan.data, connections: plan.connections, trigger: plan.trigger })}\n\nWrite the technical spec.`, "low");
  if (!r) return { tech: fallbackTech(plan.data, stack), live: false, usage: [] };
  const own = sanitizeTech({ ...r.data, env: r.data.env.map((e) => ({ ...e, provided: false })) });
  const provided = providedEnv(stack);
  own.env = [...provided, ...own.env.filter((e) => !provided.some((p) => p.name === e.name))];
  return { tech: own, live: true, usage: [r.usage] };
}

/** Three clearly different visual directions for the app, chosen to fit its audience. */
export async function designLooks(plan: Plan): Promise<Step<{ looks: AppTheme[] }>> {
  const r = await structured(LooksSchema, "looks", "You are a product designer. Propose visual directions for a web app. Make the three options clearly different from each other (different accent, heading font and sidebar). Plain language, no jargon.",
    `App: ${plan.name} — ${plan.tagline}\n${plan.summary}\n\nPropose 3 looks.`, "low");
  return r ? { looks: r.data.looks, live: true, usage: [r.usage] } : { looks: fallbackLooks(), live: false, usage: [] };
}

export { fallbackBlocks } from "./fallbacks";
