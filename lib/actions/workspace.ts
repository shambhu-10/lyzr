"use server";
import { requireUser } from "@/lib/supabase/server";
import { changeApp, clarify, generateScreen, makePlan } from "@/lib/ai/planner";
import { llmEnabled } from "@/lib/ai/llm";
import { filesFor } from "@/lib/script/files";
import { logUsage } from "@/lib/usage-log";
import { diffStats } from "@/lib/diff";
import { estimate } from "@/lib/ai/estimate";
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

export async function askQuestions(id: string, developer = false) {
  const { supabase, project } = await load(id);
  const { data: existing } = await supabase.from("messages").select("id").eq("project_id", id).eq("kind", "questions").limit(1);
  if (existing?.length) return null;
  const q = await clarify(project.prompt, developer);
  await logUsage(supabase, id, "questions", q.usage);
  return say(supabase, id, { role: "assistant", kind: "questions", content: q.intro, meta: { questions: q.questions, live: q.live } });
}

export async function submitAnswers(id: string, answers: string) {
  const { supabase, project } = await load(id);
  const userMsg = await say(supabase, id, { role: "user", kind: "answers", content: answers });
  const plan = await makePlan(project.prompt, answers);
  const { live, usage, ...clean } = plan;
  await logUsage(supabase, id, "plan", usage);
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
  const { live, usage, ...clean } = plan;
  await logUsage(supabase, id, "revise", usage);
  // Keep already-built screens' layouts when the plan still has the same screen.
  clean.screens = clean.screens.map((s) => ({ ...s, blocks: project.plan?.screens.find((o) => o.name === s.name)?.blocks }));
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

/** Real UI generation: every screen is laid out by the model, in parallel, during Build. */
export async function generateUI(id: string) {
  const { supabase, project } = await load(id);
  if (!project.plan) throw new Error("No plan");
  const plan = project.plan;
  const results = await Promise.all(plan.screens.map((s, i) => (s.blocks?.length ? null : generateScreen(plan, i))));
  const next: Plan = { ...plan, screens: plan.screens.map((s, i) => ({ ...s, blocks: results[i]?.blocks ?? s.blocks })) };
  await logUsage(supabase, id, "screen", results.flatMap((r) => r?.usage ?? []));
  await supabase.from("projects").update({ plan: next, updated_at: touch() }).eq("id", id);
  return { plan: next, live: results.every((r) => r === null || r.live) };
}

export async function finishBuild(id: string, seconds?: number) {
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
  await supabase.from("versions").insert({ project_id: id, label: "First build", snapshot: { files, plan: project.plan, summary: `Built ${project.plan.screens.length} screens and ${project.plan.agents.length} agent${project.plan.agents.length > 1 ? "s" : ""}.` } });
  const source = { ...(project.source ?? {}), build: { seconds: Math.round(seconds ?? 0), at: touch() } };
  await supabase.from("projects").update({ stage: "test", source, updated_at: touch() }).eq("id", id);
  const message = await say(supabase, id, { role: "assistant", kind: "text", content: `Build finished. ${files.length} files, ${project.plan.agents.length} agent${project.plan.agents.length > 1 ? "s" : ""}, 1 issue fixed for free. Next, I'll test it.` });
  const { data: agents } = await supabase.from("agents").select("*").eq("project_id", id).order("created_at");
  return { files, agents: agents ?? [], message };
}

export async function saveFile(id: string, path: string, content: string) {
  const { supabase } = await load(id);
  await supabase.from("files").upsert({ project_id: id, path, content, updated_at: touch() }, { onConflict: "project_id,path" });
}

export async function snapshot(id: string, label: string, extra: Record<string, unknown> = {}) {
  const { supabase, project } = await load(id);
  const { data: files } = await supabase.from("files").select("path, content").eq("project_id", id);
  const { data } = await supabase.from("versions").insert({ project_id: id, label, snapshot: { files, plan: project.plan, ...extra } }).select("id, label, created_at, snapshot").single();
  return data;
}

export async function revertTo(id: string, versionId: string) {
  const { supabase } = await load(id);
  const { data: v } = await supabase.from("versions").select("*").eq("id", versionId).single();
  const snap = (v?.snapshot ?? {}) as { files?: { path: string; content: string }[]; plan?: Plan };
  const files = snap.files ?? [];
  await supabase.from("files").delete().eq("project_id", id);
  if (files.length) await supabase.from("files").insert(files.map((f) => ({ project_id: id, path: f.path, content: f.content })));
  if (snap.plan) await supabase.from("projects").update({ plan: snap.plan, updated_at: touch() }).eq("id", id);
  await supabase.from("versions").insert({ project_id: id, label: `Restored “${v?.label}”`, snapshot: { files, plan: snap.plan, summary: `Went back to “${v?.label}”.` } });
  return { files, plan: snap.plan ?? null };
}

export async function deploy(id: string, target: "preview" | "production") {
  const { supabase } = await load(id);
  await snapshot(id, target === "production" ? "Published to production" : "Preview deployment");
  if (target === "production") await supabase.from("projects").update({ stage: "live", updated_at: touch() }).eq("id", id);
  return say(supabase, id, { role: "assistant", kind: "text", content: target === "production" ? "🎉 You're live. Share the link, or keep chatting to improve it — every change ships as a new version you can roll back." : "Preview deployed. Share it with teammates for feedback before going to production." });
}

/** Real post-build change: the model edits the app's screens, we regenerate their code and save a version with a plain summary. */
export async function quickChange(id: string, text: string) {
  const { supabase, project } = await load(id);
  if (!project.plan) throw new Error("No plan");
  const userMsg = await say(supabase, id, { role: "user", kind: "text", content: text });
  const r = await changeApp(project.plan, text);
  await logUsage(supabase, id, "change", r.usage);
  if (r.live && r.clarify.needed && r.clarify.options.length) {
    const reply = await say(supabase, id, { role: "assistant", kind: "questions", content: "Quick check before I change anything:", meta: { forChange: text, questions: [{ id: "c", text: r.clarify.question, multi: false, options: r.clarify.options.map((o) => ({ label: o })) }] } });
    return { messages: [userMsg, reply], plan: project.plan, files: null, version: null };
  }
  if (!r.live) {
    const reply = await say(supabase, id, { role: "assistant", kind: "text", content: r.summary, meta: { live: false, failed: llmEnabled } });
    return { messages: [userMsg, reply], plan: project.plan, files: null, version: null };
  }
  const plan: Plan = { ...project.plan, screens: r.screens };
  const framework = (project.source as { framework?: string } | null)?.framework ?? "lyzr";
  const { data: before } = await supabase.from("files").select("path, content").eq("project_id", id);
  const generated = filesFor(plan, framework).filter((f) => f.path.startsWith("app/"));
  const changed = generated.filter((f) => before?.find((b) => b.path === f.path)?.content !== f.content);
  if (changed.length) await supabase.from("files").upsert(changed.map((f) => ({ project_id: id, path: f.path, content: f.content, updated_at: touch() })), { onConflict: "project_id,path" });
  await supabase.from("projects").update({ plan, updated_at: touch() }).eq("id", id);
  const diff = changed.map((f) => ({ path: f.path, ...diffStats(before?.find((b) => b.path === f.path)?.content ?? "", f.content) }));
  const version = await snapshot(id, r.summary.slice(0, 80), { summary: r.summary, changes: r.changes, diff });
  const reply = await say(supabase, id, { role: "assistant", kind: "change", content: r.summary, meta: { changes: r.changes, diff } });
  const { data: files } = await supabase.from("files").select("path, content").eq("project_id", id).order("path");
  return { messages: [userMsg, reply], plan, files, version };
}

const clip = (s: unknown, n = 400) => String(s ?? "").slice(0, n);

/** Manual plan edits (inline or AGENTS.md). Server re-derives the estimate and keeps each edit as a version. */
export async function savePlan(id: string, next: Plan, via: "inline" | "agents-md") {
  const { supabase, project } = await load(id);
  if (!project.plan) throw new Error("No plan");
  // Return (not throw) user-facing errors: production redacts thrown server-action messages.
  if (!["plan", "connect"].includes(project.stage)) return { error: "The plan is locked after build — ask Architect for changes instead." };
  const plan: Plan = {
    ...project.plan,
    name: clip(next.name, 60) || project.plan.name,
    tagline: clip(next.tagline, 140),
    summary: clip(next.summary, 1200),
    scope: next.scope.slice(0, 30).map((s) => ({ item: clip(s.item, 200), status: (s.status === "later" ? "later" : "in") as "in" | "later", reason: clip(s.reason, 300) })).filter((s) => s.item),
    screens: next.screens.slice(0, 8).map((s) => ({ ...s, name: clip(s.name, 60), purpose: clip(s.purpose, 300) })).filter((s) => s.name),
    agents: next.agents.slice(0, 6).map((a) => ({ name: clip(a.name, 60), role: clip(a.role, 300), tools: (a.tools ?? []).slice(0, 10).map((t) => clip(t, 60)) })).filter((a) => a.name),
    data: next.data.slice(0, 20).map((d) => clip(d, 120)).filter(Boolean),
    connections: next.connections.slice(0, 12),
  };
  if (!plan.screens.length || !plan.agents.length) return { error: "A plan needs at least one screen and one agent." };
  plan.estimate = estimate(plan);
  await supabase.from("projects").update({ plan, name: plan.name, updated_at: touch() }).eq("id", id);
  await supabase.from("versions").insert({ project_id: id, label: via === "inline" ? "Edited the plan by hand" : "Edited AGENTS.md", snapshot: { plan, summary: "Plan edited manually." } });
  return { plan };
}
