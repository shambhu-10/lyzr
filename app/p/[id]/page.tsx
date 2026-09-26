import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Workspace } from "@/components/workspace/workspace";
import { CommandPalette } from "@/components/shell/command-palette";
import { SessionKeeper } from "@/components/shell/session-keeper";
import type { Msg } from "@/lib/actions/workspace";
import type { Project } from "@/lib/types";
import type { VersionRow } from "@/lib/workspace-types";
import type { Comment } from "@/lib/actions/comments";
import { projectSpend } from "@/lib/usage";

export default async function ProjectPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { supabase, profile, user } = await requireUser();
  const [{ data: project }, { data: messages }, { data: files }, { data: agents }, { data: versions }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("messages").select("*").eq("project_id", id).order("created_at"),
    supabase.from("files").select("path, content").eq("project_id", id).order("path"),
    supabase.from("agents").select("*").eq("project_id", id).order("created_at"),
    supabase.from("versions").select("id, label, created_at, summary:snapshot->>summary, changes:snapshot->changes, diff:snapshot->diff").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  const { data: comments } = await supabase.from("comments").select("*").eq("project_id", id).order("created_at");
  const { data: others } = await supabase.from("projects").select("stage, plan").neq("id", id).eq("owner_id", user.id);
  if (!project) notFound();
  // Owner, or a teammate via an invite (RLS already limits what they can read and write).
  const { data: member } = project.owner_id === user.id ? { data: null } : await supabase.from("project_members").select("role").eq("project_id", id).eq("user_id", user.id).maybeSingle();
  const role = project.owner_id === user.id ? "owner" : member?.role === "editor" ? "editor" : "viewer";
  return (
    <>
    <CommandPalette />
    <SessionKeeper />
    <Workspace
      initial={{ project: project as Project, messages: (messages ?? []) as Msg[], files: files ?? [], agents: agents ?? [], versions: (versions ?? []) as VersionRow[], comments: (comments ?? []) as Comment[] }}
      defaultMode={profile?.default_mode ?? "builder"}
      workspaceConnections={Object.keys(profile?.connections ?? {})}
      otherSpend={(others ?? []).reduce((a, p) => a + projectSpend(p), 0)}
      role={role}
      ownerName={(profile?.full_name ?? "").split(" ")[0]}
      bonus={Number(profile?.bonus_credits ?? 0)}
    />
    </>
  );
}
