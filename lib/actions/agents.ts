"use server";
import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { agentReply, runAgentTask, runEval, type Turn } from "@/lib/ai/agent-chat";
import { sampleContext } from "@/lib/sample-data";
import { logUsage } from "@/lib/usage-log";
import type { Plan } from "@/lib/types";

export type EvalCase = { input: string; expect: string; pass?: boolean; reason?: string; output?: string };

export async function chatWithAgent(agentId: string, history: Turn[]) {
  const { supabase } = await requireUser();
  const { data: agent } = await supabase.from("agents").select("name, instructions, model, project_id, projects(prompt)").eq("id", agentId).single();
  if (!agent) throw new Error("Agent not found");
  const prompt = (agent.projects as unknown as { prompt?: string } | null)?.prompt ?? "";
  const r = await agentReply(agent, sampleContext(prompt), history.map((t) => ({ role: t.role, content: t.content.slice(0, 4000) })));
  await logUsage(supabase, agent.project_id, "agent", [r.usage]);
  return { text: r.text, live: r.live, ms: r.ms, tokens: r.tokens };
}

/**
 * An agent button inside a generated app. Owners run it from the workspace (logged to usage);
 * visitors of a live app run it by slug through the public live_project() view.
 */
export async function runBlockAgent(input: { projectId?: string; slug?: string; agent: string; task: string; context: string }) {
  const task = input.task.slice(0, 600), context = input.context.slice(0, 4000);
  const supabase = await createClient();
  let plan: Plan | null = null;
  let projectId: string | null = null;
  if (input.projectId) {
    const { data } = await supabase.from("projects").select("id, plan").eq("id", input.projectId).single();
    plan = (data?.plan as Plan) ?? null; projectId = data?.id ?? null;
  } else if (input.slug) {
    const { data } = await supabase.rpc("live_project", { p_slug: input.slug });
    plan = (data?.[0]?.plan as Plan) ?? null;
  }
  if (!plan) throw new Error("App not found");
  const a = plan.agents.find((x) => x.name === input.agent) ?? plan.agents[0];
  const r = await runAgentTask({ name: a.name, instructions: `${a.role}. If a selectedItem is provided, work only on that item. Never send, post or delete anything; produce drafts for the user to approve.` }, task, context);
  if (projectId) await logUsage(supabase, projectId, "agent", [r.usage]);
  return { text: r.text, live: r.live };
}

export async function runEvals(agentId: string, cases: EvalCase[]) {
  const { supabase } = await requireUser();
  const { data: agent } = await supabase.from("agents").select("name, instructions, model, project_id, projects(prompt)").eq("id", agentId).single();
  if (!agent) throw new Error("Agent not found");
  const sample = sampleContext((agent.projects as unknown as { prompt?: string } | null)?.prompt ?? "");
  const results = await Promise.all(cases.slice(0, 8).map((c) => runEval(agent, sample, c.input.slice(0, 1000), c.expect.slice(0, 500)).then((r) => ({ ...c, ...r }))));
  await logUsage(supabase, agent.project_id, "eval", results.flatMap((r) => r.usage));
  const evals = results.map(({ input, expect, pass, reason, output }) => ({ input, expect, pass, reason, output }));
  await supabase.from("agents").update({ evals }).eq("id", agentId);
  return evals;
}

export async function saveEvals(agentId: string, evals: EvalCase[]) {
  const { supabase } = await requireUser();
  await supabase.from("agents").update({ evals: evals.map(({ input, expect }) => ({ input, expect })) }).eq("id", agentId);
}

export async function updateAgent(agentId: string, patch: { instructions?: string; framework?: string; model?: string; name?: string; role?: string }) {
  const { supabase } = await requireUser();
  await supabase.from("agents").update(patch).eq("id", agentId);
  revalidatePath("/agents");
}

export async function createAgent(form: FormData) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("agents").insert({
    name: String(form.get("name") || "New agent").slice(0, 60),
    role: String(form.get("role") || "").slice(0, 300),
    framework: String(form.get("framework") || "lyzr"),
    instructions: String(form.get("role") || "Be helpful and concise."),
  }).select("id").single();
  revalidatePath("/agents");
  return data?.id as string;
}

export async function deleteAgent(agentId: string) {
  const { supabase } = await requireUser();
  await supabase.from("agents").delete().eq("id", agentId);
  revalidatePath("/agents");
}
