"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { FRAMEWORKS, toStack } from "@/lib/catalog";
import { THEME_PRESETS, type AppTheme } from "@/lib/theme";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "project";

/** Short human title from the prompt until the plan names it properly. */
const draftName = (prompt: string) => {
  const words = prompt.replace(/^(build|create|make)( me)?( an?| the)?\s+/i, "").split(/\s+/).slice(0, 4).join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : "Untitled project";
};

export async function createProject(form: FormData) {
  const { supabase } = await requireUser();
  const prompt = String(form.get("prompt") ?? "").trim().slice(0, 4000);
  if (!prompt) return;
  const k = form.get("kind");
  const kind = k === "agent" ? "agent" : "app";
  const autoKind = k === "auto"; // nobody picked "Build an agent": Architect decides app vs agent from the prompt
  let theme: AppTheme | undefined; // a look picked in the "+" menu, applied when the plan is written
  try { const t = JSON.parse(String(form.get("look") ?? "null")); theme = THEME_PRESETS.find((p) => p.name === t?.name); } catch {}
  const fw = String(form.get("framework") ?? "lyzr");
  const framework = FRAMEWORKS.some((f) => f.id === fw) ? fw : "lyzr";
  const lens = form.get("lens") === "developer" ? "developer" : "builder";
  let stack = toStack(null);
  try { stack = toStack(JSON.parse(String(form.get("stack") ?? "{}"))); } catch {}
  const template = form.get("template") === "1"; // templates skip the questions and go straight to a plan
  const name = draftName(prompt);
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, prompt, kind, slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 4)}`, source: { framework, template, lens, stack, autoKind, ...(theme ? { theme } : {}) } })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("messages").insert({ project_id: data.id, role: "user", content: prompt });
  redirect(`/p/${data.id}`);
}

export async function renameProject(id: string, name: string) {
  const { supabase } = await requireUser();
  await supabase.from("projects").update({ name: name.slice(0, 80), updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/p/${id}`);
}

/** Owner only (RLS). Removes the app with everything that belongs to it: chat, files, versions, data, live URL, its agents. */
export async function deleteProject(id: string) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("owner_id").eq("id", id).single();
  if (!p || p.owner_id !== user.id) return { error: "Only the owner can delete this project." };
  await supabase.from("agents").delete().eq("project_id", id); // agents would otherwise be orphaned (project_id → null)
  const { error, count } = await supabase.from("projects").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Couldn't delete the project." };
  revalidatePath("/projects");
  revalidatePath("/home");
  return { ok: true };
}

export async function listProjectsLite() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("projects").select("id, name, stage").order("updated_at", { ascending: false }).limit(20);
  return (data ?? []) as { id: string; name: string; stage: string }[];
}
