import "server-only";
import { z } from "zod";
import { chat, structured, type Turn, type Usage } from "./llm";

export type { Turn };
type Agent = { name: string; instructions: string; model?: string };
type Reply = { text: string; live: boolean; ms: number; tokens: number; usage: Usage | null };

const system = (a: Agent, data: string) =>
  `You are "${a.name}", an AI agent inside an app built on Architect.\nInstructions: ${a.instructions}\nKeep answers short (under 170 words) and use simple markdown (**bold**, short lists). Only use this data; if something is missing, say so instead of guessing:\n${data}`;

export async function agentReply(agent: Agent, sample: string, history: Turn[]): Promise<Reply> {
  const r = await chat(system(agent, sample), history.slice(-12), agent.model);
  if (r === null) return { text: offlineReply(agent.name, sample), live: false, ms: 0, tokens: 0, usage: null };
  if (r === undefined) return { text: "The agent couldn't respond just now. Please try again.", live: false, ms: 0, tokens: 0, usage: null };
  return { text: r.text, live: true, ms: r.usage.ms, tokens: r.usage.input_tokens + r.usage.output_tokens, usage: r.usage };
}

/** Run an agent from a button inside the generated app (real work on the screen's data). */
export async function runAgentTask(agent: Agent, task: string, context: string): Promise<Reply> {
  return agentReply(agent, context, [{ role: "user", content: task }]);
}

const Verdict = z.object({ pass: z.boolean(), reason: z.string().describe("One short sentence") });

/** Plain-English evals: run the agent on the input, then an LLM judge checks the expectation. */
export async function runEval(agent: Agent, sample: string, input: string, expect: string) {
  const out = await agentReply(agent, sample, [{ role: "user", content: input }]);
  if (!out.live) return { output: out.text, pass: false, reason: "Couldn't run — AI unavailable.", usage: [] as Usage[] };
  const v = await structured(Verdict, "eval", "You are a strict QA judge for AI agent outputs.",
    `Agent output:\n"""${out.text}"""\n\nExpectation (written by the user): "${expect}"\n\nDoes the output meet the expectation?`, "low");
  return { output: out.text, pass: v?.data.pass ?? false, reason: v?.data.reason ?? "Judge unavailable.", usage: [out.usage!, ...(v ? [v.usage] : [])] };
}

// Scripted answer grounded in the sample data, so the playground demo works without an API key.
function offlineReply(name: string, sample: string) {
  let d: { selected_event?: { title: string; when: string; organizer: string; attendees: { name: string; status: string }[] } } = {};
  try { d = JSON.parse(sample); } catch {}
  const e = d.selected_event;
  if (!e) return `(${name} · offline demo) I'd answer here using only your connected data. Add a Groq API key for live responses.`;
  const pending = e.attendees.filter((a) => a.status !== "Accepted").map((a) => a.name).join(", ") || "nobody";
  return `**${e.title}** — ${e.when}\n\n**Why it matters:** lock Q4 priorities; capacity is the constraint.\n**Who:** ${e.organizer} (organizer) + ${e.attendees.length} attendees. Not yet confirmed: ${pending}.\n**Ask:** which bet do we drop if capacity stays flat?\n\n_(offline demo reply — add a Groq API key for live answers)_`;
}
