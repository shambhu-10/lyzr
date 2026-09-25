"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

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
  const kind = form.get("kind") === "agent" ? "agent" : "app";
  const framework = String(form.get("framework") ?? "lyzr");
  const name = draftName(prompt);
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, prompt, kind, slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 4)}`, source: { framework } })
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

export async function deleteProject(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projects");
}
