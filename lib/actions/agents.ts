"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { agentReply, type Turn } from "@/lib/ai/agent-chat";
import { sampleContext } from "@/lib/sample-data";

export async function chatWithAgent(agentId: string, history: Turn[]) {
  const { supabase } = await requireUser();
  const { data: agent } = await supabase.from("agents").select("name, instructions, model, project_id, projects(prompt)").eq("id", agentId).single();
  if (!agent) throw new Error("Agent not found");
  const prompt = (agent.projects as unknown as { prompt?: string } | null)?.prompt ?? "";
  return agentReply(agent, sampleContext(prompt), history.map((t) => ({ role: t.role, content: t.content.slice(0, 4000) })));
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
