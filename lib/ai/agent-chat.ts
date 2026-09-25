import "server-only";
import { chat, type Turn } from "./llm";

export type { Turn };

export async function agentReply(agent: { name: string; instructions: string; model?: string }, sample: string, history: Turn[]): Promise<{ text: string; live: boolean; ms: number; tokens: number }> {
  const system = `You are "${agent.name}", an AI agent inside an app built on Architect.\nInstructions: ${agent.instructions}\nYou are being tested in a playground. Keep answers short (under 150 words), use simple markdown, and only use this data:\n${sample}`;
  const r = await chat(system, history.slice(-12), agent.model);
  if (r === null) return { text: offlineReply(agent.name, sample), live: false, ms: 0, tokens: 0 };
  if (r === undefined) return { text: "The agent couldn't respond just now. Please try again.", live: false, ms: 0, tokens: 0 };
  return { ...r, live: true };
}

// Scripted answer grounded in the sample data, so the playground demo works without an API key.
function offlineReply(name: string, sample: string) {
  const d = JSON.parse(sample) as { selected_event?: { title: string; when: string; organizer: string; attendees: { name: string; status: string }[] } };
  const e = d.selected_event;
  if (!e) return `(${name} · offline demo) I'd answer here using only your connected data. Add a Groq API key for live responses.`;
  const pending = e.attendees.filter((a) => a.status !== "Accepted").map((a) => a.name).join(", ") || "nobody";
  return `**${e.title}** — ${e.when}\n\n**Why it matters:** lock Q4 priorities; capacity is the constraint.\n**Who:** ${e.organizer} (organizer) + ${e.attendees.length} attendees. Not yet confirmed: ${pending}.\n**Ask:** which bet do we drop if capacity stays flat?\n\n_(offline demo reply — add a Groq API key for live answers)_`;
}
