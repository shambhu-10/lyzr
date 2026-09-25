import "server-only";
import { z } from "zod";
import { structured } from "./llm";
import { INTEGRATIONS } from "@/lib/integrations";
import type { Plan, Question } from "@/lib/types";
import { estimate } from "./estimate";


const QuestionsSchema = z.object({
  intro: z.string().describe("One or two sentences restating the idea in plain language and what you'll clarify."),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    multi: z.boolean().describe("true if several options can be chosen"),
    options: z.array(z.object({ label: z.string(), hint: z.string() })).min(2).max(4),
  })).min(2).max(4),
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
  screens: z.array(z.object({
    name: z.string(),
    purpose: z.string(),
    metrics: z.array(z.object({ label: z.string(), value: z.string() })).describe("0-3 realistic headline numbers for this screen; empty if none make sense (e.g. a login screen)"),
    rows: z.array(z.object({ title: z.string(), meta: z.string() })).describe("3-4 realistic sample items this screen would list, e.g. an email subject + sender; empty for forms"),
    action: z.string().describe("Label of the main button on this screen, e.g. 'Generate reply'"),
  })).min(2).max(5).describe("The main app screens. Skip login/sign-up — Architect adds authentication automatically."),
  agents: z.array(z.object({ name: z.string(), role: z.string(), tools: z.array(z.string()) })).min(1).max(4),
  data: z.array(z.string()).describe("What the app stores, plain language; empty if nothing"),
  connections: z.array(z.object({
    id: z.string().describe(`For OAuth use one of: ${INTEGRATIONS.map((i) => i.id).join(", ")}. For API keys use an ENV_VAR_NAME.`),
    name: z.string(),
    why: z.string().describe("Plain-language reason, e.g. 'to read your upcoming meetings'"),
    kind: z.enum(["oauth", "apikey"]),
  })).describe("Every EXTERNAL account or key the app needs to work on real data. Not the database, auth, hosting or AI model — Architect provides those."),
});

const SYSTEM = `You are Architect, a product planner inside a platform that builds agentic web apps (Next.js UI + AI agents).
Audience: often non-technical business users; write in plain, warm, concise language. No jargon like "schema", "temperature", "manifest".
You design small, shippable v1s — but you are transparent: anything the user asked for that you defer must appear in scope with status "later" and a reason.
Identify every connection the app needs to work on real data (calendars, email, CRMs, API keys) so the user can connect them BEFORE building.
Architect itself provides the database, user sign-in, hosting and the AI model — never list those as connections.`;

const ask = <T extends z.ZodType>(schema: T, effort: "low" | "medium", user: string) => structured(schema, "plan_step", SYSTEM, user, effort);

export async function clarify(prompt: string): Promise<{ intro: string; questions: Question[]; live: boolean }> {
  const out = await ask(QuestionsSchema, "low", `The user wants to build:\n"""${prompt}"""\n\nAsk 2-4 multiple-choice clarifying questions that most change what gets built (e.g. which tools/ecosystem, which features in v1, whether to save data, who uses it). Recommended option first.`);
  return out ? { ...out, live: true } : { ...fallbackQuestions(prompt), live: false };
}

export async function makePlan(prompt: string, answers: string, current?: Plan | null, instruction?: string): Promise<Plan & { live: boolean }> {
  const user = [
    `Original request:\n"""${prompt}"""`,
    answers && `User's answers to clarifying questions:\n${answers}`,
    current && `Current plan (JSON):\n${JSON.stringify(current)}`,
    instruction && `Revise the plan according to this instruction from the user: "${instruction}"`,
    "Write the v1 plan.",
  ].filter(Boolean).join("\n\n");
  const out = await ask(PlanSchema, "medium", user);
  const plan = out ?? fallbackPlan(prompt, current, instruction);
  return { ...plan, estimate: estimate(plan), live: !!out };
}

/* ---------- offline fallbacks: the demo never dead-ends if the API is unavailable ---------- */

const isMeeting = (p: string) => /meeting|calendar|brief/i.test(p);

function fallbackQuestions(prompt: string) {
  if (isMeeting(prompt))
    return {
      intro: "A meeting assistant can combine your calendar, quick research and transcript-based follow-ups — with every email kept as a draft for your approval.",
      questions: [
        { id: "eco", text: "Which calendar and email should it use?", multi: false, options: [{ label: "Google Workspace", hint: "Google Calendar + Gmail drafts" }, { label: "Microsoft 365", hint: "Outlook calendar + drafts" }] },
        { id: "features", text: "What should v1 include?", multi: true, options: [{ label: "Meeting briefs", hint: "Agenda, attendees, context" }, { label: "Attendee research", hint: "Recent company & people news" }, { label: "Transcript follow-ups", hint: "Recap + action items + email draft" }] },
        { id: "data", text: "Should it remember past meetings?", multi: false, options: [{ label: "Yes, keep a history", hint: "Briefs and follow-ups saved" }, { label: "No, nothing stored", hint: "Each run is fresh" }] },
      ],
    };
  return {
    intro: "Here's how I understand your idea. A few quick choices will shape what I build first.",
    questions: [
      { id: "users", text: "Who will use it?", multi: false, options: [{ label: "Just me", hint: "Personal tool" }, { label: "My team", hint: "Shared workspace with sign-in" }, { label: "Customers", hint: "Public-facing app" }] },
      { id: "ai", text: "What should the AI agent do?", multi: true, options: [{ label: "Analyse and summarise", hint: "Reads inputs, produces insights" }, { label: "Take actions", hint: "Updates tools — with your approval" }, { label: "Answer questions", hint: "Chat over your data" }] },
      { id: "data", text: "Should it save data between sessions?", multi: false, options: [{ label: "Yes", hint: "Records and history" }, { label: "No", hint: "Nothing stored" }] },
    ],
  };
}

function fallbackPlan(prompt: string, current?: Plan | null, instruction?: string): Omit<Plan, "estimate"> {
  if (current) {
    const add = instruction?.replace(/^add back:?\s*/i, "") ?? "";
    return { ...current, scope: current.scope.map((s) => (add && s.item.toLowerCase() === add.toLowerCase() ? { ...s, status: "in", reason: "" } : s)) };
  }
  if (isMeeting(prompt))
    return {
      name: "Briefly",
      tagline: "Walk into every meeting prepared.",
      summary: "Briefly reads your upcoming Google Calendar events and writes a one-page brief for any meeting you pick — who's attending, why it matters, and what to ask. Follow-up emails are always drafts you approve.",
      scope: [
        { item: "Meeting briefs from your calendar", status: "in", reason: "" },
        { item: "Focus notes (e.g. “budget risks”)", status: "in", reason: "" },
        { item: "Attendee & company research", status: "later", reason: "Needs a web-search connection; easy to add next." },
        { item: "Follow-up emails from transcripts", status: "later", reason: "Needs Gmail drafts + transcript upload; planned for v2." },
      ],
      screens: [
        { name: "Agenda", purpose: "Today's and upcoming meetings in order" },
        { name: "Meeting context", purpose: "Verify event details and add a focus" },
        { name: "Brief", purpose: "The generated one-page brief, copyable by section" },
      ],
      agents: [{ name: "Meeting Brief Agent", role: "Turns a calendar event and your focus into a grounded brief", tools: ["Google Calendar"] }],
      data: [],
      connections: [{ id: "google-calendar", name: "Google Calendar", why: "to read your upcoming meetings (read-only)", kind: "oauth" }],
    };
  const title = prompt.split(/\s+/).slice(0, 3).join(" ");
  return {
    name: title.charAt(0).toUpperCase() + title.slice(1),
    tagline: "Your idea, as a working app.",
    summary: `A focused first version of: ${prompt}`,
    scope: [{ item: "Core workflow from your description", status: "in", reason: "" }, { item: "Team sharing & roles", status: "later", reason: "Add once the core flow is validated." }],
    screens: [{ name: "Dashboard", purpose: "Overview of everything in one place" }, { name: "Workspace", purpose: "Where the main task happens" }, { name: "Results", purpose: "Outputs from the AI agent" }],
    agents: [{ name: "Assistant Agent", role: "Does the core reasoning task described in your prompt", tools: [] }],
    data: ["Your records and results"],
    connections: [],
  };
}
