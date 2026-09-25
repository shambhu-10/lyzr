"use server";
import { requireUser } from "@/lib/supabase/server";
import { scan, secretOnLine } from "@/lib/security-scan";
import { setSecret } from "@/lib/actions/secrets";
import type { Project } from "@/lib/types";

async function context(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Project not found"); // id goes into a PostgREST filter below
  const { supabase } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) throw new Error("Project not found");
  const [{ data: files }, { data: secrets }, { data: agents }] = await Promise.all([
    supabase.from("files").select("path, content").eq("project_id", id),
    supabase.from("secrets").select("name, project_id").or(`project_id.eq.${id},project_id.is.null`),
    supabase.from("agents").select("id, name, tools, instructions").eq("project_id", id),
  ]);
  return { supabase, project: project as Project, files: files ?? [], vault: (secrets ?? []).map((s) => s.name as string), agents: agents ?? [] };
}

/** Real pre-ship scan over the project's code, vault, connections and agents. Excerpts are masked. */
export async function securityScan(id: string) {
  const c = await context(id);
  return scan({ files: c.files, plan: c.project.plan, connections: c.project.connections, demo: c.project.demo_data, vault: c.vault, agents: c.agents });
}

/** Moves a hardcoded secret into the encrypted vault and rewrites that line to read it from the environment. */
export async function moveSecretToVault(id: string, path: string, line: number) {
  const c = await context(id);
  const file = c.files.find((f) => f.path === path);
  const lines = file?.content.split("\n");
  const s = lines && secretOnLine(lines[line - 1] ?? "");
  if (!file || !lines || !s) return { error: "That secret is no longer in the file." };
  const esc = s.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = lines[line - 1];
  // "gsk_…" → process.env.X ; inside a longer string → ${process.env.X} in a template literal
  let after = before.replace(new RegExp(`(["'\`])${esc}\\1`), `process.env.${s.env}`);
  if (after === before) after = before.replace(new RegExp(`(["'])([^"']*)${esc}([^"']*)\\1`), (_: string, _q: string, a: string, b: string) => `\`${a}\${process.env.${s.env}}${b}\``);
  if (after === before) return { error: "Couldn't rewrite this line automatically — move it by hand in the editor." };
  const saved = await setSecret(id, "all", s.env, s.literal);
  if ("error" in saved) return { error: saved.error };
  lines[line - 1] = after;
  const content = lines.join("\n");
  await c.supabase.from("files").update({ content, updated_at: new Date().toISOString() }).eq("project_id", id).eq("path", path);
  const { data: all } = await c.supabase.from("files").select("path, content").eq("project_id", id);
  await c.supabase.from("versions").insert({ project_id: id, label: `Moved a secret to the vault (${s.env})`, snapshot: { files: all, plan: c.project.plan, summary: `${path}:${line} now reads ${s.env} from the vault.` } });
  return { path, content, env: s.env };
}

/** Agents that can act (send, post, delete…) get an explicit human-approval rule. */
export async function addApprovalStep(id: string, agentName: string) {
  const c = await context(id);
  const a = c.agents.find((x) => x.name === agentName);
  if (!a) return { error: "Agent not found." };
  const instructions = `${a.instructions ?? ""}\n\nApproval: draft first. Never send, post, pay or delete anything until a person explicitly confirms.`.trim();
  await c.supabase.from("agents").update({ instructions }).eq("id", a.id);
  return { ok: true };
}
