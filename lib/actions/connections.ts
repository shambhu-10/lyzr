"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function setWorkspaceConnection(id: string, connected: boolean) {
  const { supabase, user, profile } = await requireUser();
  const next = { ...(profile?.connections ?? {}) };
  if (connected) next[id] = new Date().toISOString();
  else delete next[id];
  await supabase.from("profiles").update({ connections: next }).eq("id", user.id);
  revalidatePath("/connections");
}
