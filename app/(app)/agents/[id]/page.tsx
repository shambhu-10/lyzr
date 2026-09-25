import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { AgentDetail } from "@/components/agents/agent-detail";
import type { AgentRow } from "@/lib/workspace-types";

export default async function AgentPage({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const { data } = await supabase.from("agents").select("*").eq("id", id).single();
  if (!data) notFound();
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <div className="border-b px-6 py-4 md:px-10">
        <Link href="/agents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Agents</Link>
      </div>
      <AgentDetail agent={data as AgentRow} defaultMode={profile?.default_mode ?? "builder"} />
    </div>
  );
}
