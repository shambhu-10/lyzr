"use server";
import { requireUser } from "@/lib/supabase/server";
import { clarify, makePlan } from "@/lib/ai/planner";
import { filesFor } from "@/lib/script/files";
import type { Plan, Project, Stage } from "@/lib/types";

export type Msg = { id: string; role: "user" | "assistant"; kind: string; content: string; meta: Record<string, unknown> | null; created_at: string };

async function load(id: string) {
  const ctx = await requireUser();
  const { data } = await ctx.supabase.from("projects").select("*").eq("id", id).single();
  if (!data) throw new Error("Project not found");
  return { ...ctx, project: data as Project };
}

async function say(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], project_id: string, m: Pick<Msg, "role" | "kind" | "content"> & { meta?: unknown }) {
  const { data } = await supabase.from("messages").insert({ project_id, ...m }).select().single();
  return data as Msg;
}

const touch = () => new Date().toISOString();

export async function askQuestions(id: string) {
  const { supabase, project } = await load(id);
  const { data: existing } = await supabase.from("messages").select("id").eq("project_id", id).eq("kind", "questions").limit(1);
  if (existing?.length) return null;
  const q = await clarify(project.prompt);
  return say(supabase, id, { role: "assistant", kind: "questions", content: q.intro, meta: { questions: q.questions, live: q.live } });
}

export async function submitAnswers(id: string, answers: string) {
  const { supabase, project } = await load(id);
  const userMsg = await say(supabase, id, { role: "user", kind: "answers", content: answers });
  const plan = await makePlan(project.prompt, answers);
  const { live, ...clean } = plan;
  // First plan names the product — give the public URL that name too (it's not live yet, so nothing breaks).
  const slug = `${clean.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "app"}-${crypto.randomUUID().slice(0, 4)}`;
  await supabase.from("projects").update({ plan: clean, name: clean.name, slug, updated_at: touch() }).eq("id", id);
  const later = clean.scope.filter((s) => s.status === "later").length;
  const reply = await say(supabase, id, {
    role: "assistant", kind: "plan",
    content: `Here's the plan for **${clean.name}**: ${clean.screens.length} screens and ${clean.agents.length} agent${clean.agents.length > 1 ? "s" : ""}.${later ? ` I've kept ${later} thing${later > 1 ? "s" : ""} you asked for as “later” so v1 ships fast — you can add ${later > 1 ? "them" : "it"} back anytime.` : ""} Review it on the right, then approve when you're happy.`,
    meta: { live },
  });
  return { plan: clean as Plan, slug, messages: [userMsg, reply] };
}

export async function revisePlan(id: string, instruction: string) {
  const { supabase, project } = await load(id);
  const userMsg = await say(supabase, id, { role: "user", kind: "text", content: instruction });
  const plan = await makePlan(project.prompt, "", project.plan, instruction);
  const { live, ...clean } = plan;
  await supabase.from("projects").update({ plan: clean, name: clean.name, updated_at: touch() }).eq("id", id);
  const reply = await say(supabase, id, { role: "assistant", kind: "text", content: "Updated the plan on the right and recalculated the estimate.", meta: { live } });
  return { plan: clean as Plan, messages: [userMsg, reply] };
}

export async function setStage(id: string, stage: Stage) {
  const { supabase } = await load(id);
  await supabase.from("projects").update({ stage, updated_at: touch() }).eq("id", id);
}

export async function setConnection(id: string, key: string, status: "connected" | "sample") {
  const { supabase, project } = await load(id);
  const connections = { ...project.connections, [key]: status };
  const demo_data = Object.values(connections).includes("sample");
  await supabase.from("projects").update({ connections, demo_data, updated_at: touch() }).eq("id", id);
  return { connections, demo_data };
}

export async function finishBuild(id: string) {
  const { supabase, project } = await load(id);
  if (!project.plan) throw new Error("No plan");
  const framework = (project.source as { framework?: string } | null)?.framework ?? "lyzr";
  const files = filesFor(project.plan, framework);
  await supabase.from("files").upsert(files.map((f) => ({ project_id: id, path: f.path, content: f.content, updated_at: touch() })), { onConflict: "project_id,path" });
  const { count } = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("project_id", id);
  if (!count)
    await supabase.from("agents").insert(project.plan.agents.map((a) => ({
      project_id: id, name: a.name, role: a.role, framework, tools: a.tools, model: "openai/gpt-oss-120b",
      instructions: `${a.role}. Ground every answer in the provided data; say what's missing instead of guessing. Never send or post anything without the user's approval.`,
    })));
  await supabase.from("versions").insert({ project_id: id, label: "First build", snapshot: { files } });
  await supabase.from("projects").update({ stage: "test", updated_at: touch() }).eq("id", id);
  const message = await say(supabase, id, { role: "assistant", kind: "text", content: `Build finished. ${files.length} files, ${project.plan.agents.length} agent${project.plan.agents.length > 1 ? "s" : ""}, 1 issue fixed for free. Next, I'll test it.` });
  const { data: agents } = await supabase.from("agents").select("*").eq("project_id", id).order("created_at");
  return { files, agents: agents ?? [], message };
}

export async function saveFile(id: string, path: string, content: string) {
  const { supabase } = await load(id);
  await supabase.from("files").upsert({ project_id: id, path, content, updated_at: touch() }, { onConflict: "project_id,path" });
}

export async function snapshot(id: string, label: string) {
  const { supabase } = await load(id);
  const { data: files } = await supabase.from("files").select("path, content").eq("project_id", id);
  const { data } = await supabase.from("versions").insert({ project_id: id, label, snapshot: { files } }).select().single();
  return data;
}

export async function revertTo(id: string, versionId: string) {
  const { supabase } = await load(id);
  const { data: v } = await supabase.from("versions").select("*").eq("id", versionId).single();
  const files = (v?.snapshot as { files?: { path: string; content: string }[] } | null)?.files ?? [];
  await supabase.from("files").delete().eq("project_id", id);
  if (files.length) await supabase.from("files").insert(files.map((f) => ({ project_id: id, path: f.path, content: f.content })));
  await supabase.from("versions").insert({ project_id: id, label: `Restored “${v?.label}”`, snapshot: { files } });
  return files;
}

export async function deploy(id: string, target: "preview" | "production") {
  const { supabase } = await load(id);
  await snapshot(id, target === "production" ? "Published to production" : "Preview deployment");
  if (target === "production") await supabase.from("projects").update({ stage: "live", updated_at: touch() }).eq("id", id);
  return say(supabase, id, { role: "assistant", kind: "text", content: target === "production" ? "🎉 You're live. Share the link, or keep chatting to improve it — every change ships as a new version you can roll back." : "Preview deployed. Share it with teammates for feedback before going to production." });
}

/** Post-build change request. ponytail: reply is scripted; real code-gen would stream edits here. */
export async function quickChange(id: string, text: string) {
  const { supabase } = await load(id);
  const userMsg = await say(supabase, id, { role: "user", kind: "text", content: text });
  const reply = await say(supabase, id, { role: "assistant", kind: "text", content: `Done — I applied “${text.slice(0, 80)}” and saved it as a new version. Review it in Preview; you can roll back from Versions anytime.` });
  const version = await snapshot(id, `Change: ${text.slice(0, 40)}`);
  return { messages: [userMsg, reply], version };
}
