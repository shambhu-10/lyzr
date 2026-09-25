"use server";
import { requireUser } from "@/lib/supabase/server";

export type Comment = { id: string; screen: string; target: string; body: string; status: "open" | "sent" | "resolved"; created_at: string };

export async function addComment(projectId: string, screen: string, target: string, body: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("comments").insert({ project_id: projectId, screen, target, body: body.slice(0, 1000) }).select().single();
  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function markComments(ids: string[], status: Comment["status"]) {
  const { supabase } = await requireUser();
  await supabase.from("comments").update({ status }).in("id", ids);
}
