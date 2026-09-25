import "server-only";
import { z } from "zod";
import { structured, type Usage } from "./llm";
import { INTEGRATIONS } from "@/lib/integrations";
import type { Block, Plan, Question, Screen } from "@/lib/types";
import { estimate } from "./estimate";
import { fallbackBlocks, fallbackPlan, fallbackQuestions } from "./fallbacks";

/* ---------------- schemas (Groq strict mode: every field required, empty values instead of optional) ---------------- */

const QuestionsSchema = z.object({
  intro: z.string().describe("One or two sentences restating the idea in plain language and what you'll clarify."),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
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

const ScreenUISchema = z.object({ blocks: z.array(BlockSchema).min(2).max(5) });

const ChangeSchema = z.object({
  summary: z.string().describe("One plain-language sentence a non-technical user understands, e.g. 'Made the brief shorter and added a copy button'"),
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

export async function clarify(prompt: string): Promise<Step<{ intro: string; questions: Question[] }>> {
  const r = await structured(QuestionsSchema, "clarify", SYSTEM, `The user wants to build:\n"""${prompt}"""\n\nAsk 2-4 multiple-choice clarifying questions that most change what gets built (e.g. which tools/ecosystem, which features in v1, whether to save data, who uses it). Recommended option first.`, "low");
  return r ? { ...r.data, live: true, usage: [r.usage] } : { ...fallbackQuestions(prompt), live: false, usage: [] };
}

export async function makePlan(prompt: string, answers: string, current?: Plan | null, instruction?: string): Promise<Step<Plan>> {
  const user = [
    `Original request:\n"""${prompt}"""`,
    answers && `User's answers to clarifying questions:\n${answers}`,
    current && `Current plan (JSON):\n${JSON.stringify({ ...current, screens: current.screens.map((s) => ({ name: s.name, purpose: s.purpose, metrics: s.metrics ?? [], rows: s.rows ?? [], action: s.action ?? "" })) })}`,
    instruction && `Revise the plan according to this instruction from the user: "${instruction}"`,
    "Write the v1 plan.",
  ].filter(Boolean).join("\n\n");
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
export async function changeApp(plan: Plan, instruction: string): Promise<Step<{ summary: string; changes: string[]; screens: Screen[] }>> {
  const r = await structured(ChangeSchema, "change", `${UI_SYSTEM}\nYou are editing an existing app. Change only what the request needs; keep everything else identical.`,
    `Current app (JSON):\n${JSON.stringify({ name: plan.name, agents: plan.agents, connections: plan.connections, screens: plan.screens })}\n\nChange request: "${instruction}"`, "medium");
  if (r) return { ...r.data, live: true, usage: [r.usage] };
  return { summary: "I couldn't apply that change right now — your app is unchanged.", changes: [], screens: plan.screens, live: false, usage: [] };
}

export { fallbackBlocks } from "./fallbacks";
