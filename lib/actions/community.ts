"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";

/** Opt a live app in or out of the public gallery, with the name the owner chooses to show. */
export async function setShowcase(id: string, on: boolean, author: string) {
  const { supabase } = await requireUser();
  const showcase_author = author.replace(/\s+/g, " ").trim().slice(0, 40) || null;
  const { error } = await supabase.from("projects").update({ showcase: on, showcase_author }).eq("id", id);
  if (error) return { error: error.message.includes("showcase") ? "Run migration 0004 to enable the gallery." : "Couldn't update the gallery setting." };
  return { ok: true };
}

/** Copy a live app's plan into the caller's workspace. Their own accounts get connected fresh. */
export async function remixProject(slug: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("live_project", { p_slug: slug });
  const row = data?.[0] as { name: string; plan: Plan } | undefined;
  if (!row) return { error: "That app isn't live anymore." };
  const plan: Plan = { ...row.plan, screens: row.plan.screens.map((s) => ({ ...s })) };
  const { data: created, error } = await supabase.from("projects").insert({
    name: `${row.name} (remix)`.slice(0, 80), prompt: `Remix of ${row.name}: ${row.plan.summary}`.slice(0, 4000), kind: "app",
    slug: `${slug.replace(/-[a-z0-9]{4}$/, "").slice(0, 24)}-${crypto.randomUUID().slice(0, 4)}`,
    stage: "connect", plan, connections: {}, demo_data: false, source: { framework: "lyzr", remixed_from: slug },
  }).select("id").single();
  if (error || !created) return { error: "Couldn't create the remix." };
  await supabase.from("messages").insert({ project_id: created.id, role: "assistant", kind: "text", content: `You remixed **${row.name}**. The plan, screens and agents are copied — connect your own accounts, then build. Nothing from the original owner's data comes with it.` });
  await supabase.rpc("record_remix", { p_slug: slug });
  redirect(`/p/${created.id}`);
}
