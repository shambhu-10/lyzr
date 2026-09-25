import Link from "next/link";
import { Bot } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ImportAgentButton, NewAgentButton } from "@/components/agents/agent-actions";
import { frameworkLabel } from "@/lib/catalog";
import { timeAgo } from "@/components/projects/project-card";

export default async function AgentsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("agents").select("id, name, role, framework, model, created_at, projects(name)").order("created_at", { ascending: false });
  const agents = (data ?? []) as unknown as { id: string; name: string; role: string; framework: string; model: string; created_at: string; projects: { name: string } | null }[];
  return (
    <>
      <PageHeader title="Agents" description="Every agent in your workspace — built here or imported, in any framework. Configure, test, trace and reuse them." actions={<><ImportAgentButton /><NewAgentButton /></>} />
      <div className="px-6 py-6 md:px-10">
        {agents.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3 font-normal">Agent</th><th className="hidden p-3 font-normal md:table-cell">Framework</th><th className="hidden p-3 font-normal md:table-cell">Used in</th><th className="p-3 font-normal">Created</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3"><Link href={`/agents/${a.id}`} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Bot className="size-4" /></span><span><span className="block font-medium">{a.name}</span><span className="line-clamp-1 text-xs text-muted-foreground">{a.role}</span></span></Link></td>
                    <td className="hidden p-3 md:table-cell"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{frameworkLabel(a.framework)}</span></td>
                    <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">{a.projects?.name ?? "Standalone"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{timeAgo(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
            <Bot className="size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">No agents yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Agents are created when you build a project — or create a standalone one, or import one you already have in LangGraph, CrewAI or the OpenAI Agents SDK.</p>
            <div className="mt-5 flex gap-2"><NewAgentButton /><ImportAgentButton /></div>
          </div>
        )}
      </div>
    </>
  );
}
