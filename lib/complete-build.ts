import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seedExampleRows } from "@/lib/actions/app-data";
import { toStack } from "@/lib/catalog";
import type { Check, Project } from "@/lib/types";

type Files = { path: string; content: string }[];

/**
 * What every build ends with, scripted or real: save the code, create the agents, keep a version,
 * seed example data, move to Test. `real` carries the sandbox's preview and the checks that actually ran.
 */
export async function completeBuild(supabase: SupabaseClient, project: Project, files: Files, seconds: number, real?: { summary: string; checks: Check[]; preview: { sandbox: string; url: string } }) {
  const id = project.id;
  const plan = project.plan!;
  const framework = project.source?.framework ?? "lyzr";
  const touch = new Date().toISOString();
  if (real) await supabase.from("files").delete().eq("project_id", id); // the sandbox's files are the code now
  await supabase.from("files").upsert(files.map((f) => ({ project_id: id, path: f.path, content: f.content, updated_at: touch })), { onConflict: "project_id,path" });
  const { count } = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("project_id", id);
  if (!count)
    await supabase.from("agents").insert(plan.agents.map((a) => ({
      project_id: id, name: a.name, role: a.role, framework, tools: a.tools, model: toStack(project.source?.stack).model, evals: (plan.tests ?? []).map((t) => ({ input: t.input, expect: t.expect })),
      instructions: `${a.role}. Ground every answer in the provided data; say what's missing instead of guessing. Never send or post anything without the user's approval.`,
    })));
  const agentsNote = `${plan.agents.length} agent${plan.agents.length === 1 ? "" : "s"}`;
  const summary = real?.summary ?? `Built ${plan.screens.length} screens and ${agentsNote}.`;
  await supabase.from("versions").insert({ project_id: id, label: "First build", snapshot: { files, plan, summary } });
  await seedExampleRows(id).catch(() => {}); // example rows for the Data tab (skipped if migration 0005 isn't applied)
  const source = { ...(project.source ?? {}), build: { seconds: Math.round(seconds), at: touch, ...(real ? { checks: real.checks } : {}) }, ...(real ? { preview: real.preview } : {}) };
  await supabase.from("projects").update({ stage: "test", source, updated_at: touch }).eq("id", id);
  const content = real
    ? `Built and verified in a sandbox: ${files.length} files, the production build passes and the app is running. ${real.summary}`
    : `Build finished. ${files.length} files, ${agentsNote}${plan.screens.length ? ", 1 issue fixed for free" : ""}. Next, I'll test it.`;
  const { data: message } = await supabase.from("messages").insert({ project_id: id, role: "assistant", kind: "text", content }).select().single();
  const { data: agents } = await supabase.from("agents").select("*").eq("project_id", id).order("created_at");
  return { files, agents: agents ?? [], message, source };
}
