"use server";
import { requireUser } from "@/lib/supabase/server";

export type Person = { user_id: string; name: string; role: "owner" | "editor" | "viewer"; is_you: boolean };
const missing = (m: string) => /project_(members|invites|people)|accept_invite/.test(m);

/** Owner-only (enforced by RLS): a 7-day link that adds whoever opens it with this role. */
export async function createInvite(projectId: string, role: "viewer" | "editor") {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("project_invites").insert({ project_id: projectId, role: role === "editor" ? "editor" : "viewer" }).select("token").single();
  if (error) return { error: missing(error.message) ? "Run migration 0004 to enable sharing." : "Only the project owner can invite people." };
  return { token: data.token as string };
}

export async function listPeople(projectId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("project_people", { p_project: projectId });
  if (error) return { error: missing(error.message) ? "Run migration 0004 to enable sharing." : error.message };
  return { people: (data ?? []) as Person[] };
}

export async function removeMember(projectId: string, userId: string) {
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from("project_members").delete({ count: "exact" }).eq("project_id", projectId).eq("user_id", userId);
  if (error || !count) return { error: "Only the owner can remove people." };
  return { ok: true };
}

export async function acceptInvite(token: string) {
  const { supabase } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This invite link is invalid." };
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: error.message.includes("expired") || error.message.includes("invalid") ? "This invite link is invalid or has expired." : "Couldn't accept the invite." };
  return { projectId: data as string };
}
