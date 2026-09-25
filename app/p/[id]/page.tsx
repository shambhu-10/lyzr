import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Workspace } from "@/components/workspace/workspace";
import type { Msg } from "@/lib/actions/workspace";
import type { Project } from "@/lib/types";
import { projectSpend } from "@/lib/usage";

export default async function ProjectPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const [{ data: project }, { data: messages }, { data: files }, { data: agents }, { data: versions }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("messages").select("*").eq("project_id", id).order("created_at"),
    supabase.from("files").select("path, content").eq("project_id", id).order("path"),
    supabase.from("agents").select("*").eq("project_id", id).order("created_at"),
    supabase.from("versions").select("id, label, created_at").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  const { data: others } = await supabase.from("projects").select("stage, plan").neq("id", id);
  if (!project) notFound();
  return (
    <Workspace
      initial={{ project: project as Project, messages: (messages ?? []) as Msg[], files: files ?? [], agents: agents ?? [], versions: versions ?? [] }}
      defaultMode={profile?.default_mode ?? "builder"}
      otherSpend={(others ?? []).reduce((a, p) => a + projectSpend(p), 0)}
    />
  );
}
