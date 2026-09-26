import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { AppPreview } from "@/components/app-preview/app-preview";
import { LiveAgent } from "@/components/agents/live-agent";
import type { Plan } from "@/lib/types";

export const metadata = { title: "Preview — Architect" };

/** The app as it is right now, before (or without) deploying. Private: RLS only returns projects you own or were invited to. */
export default async function Preview({ params }: PageProps<"/preview/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("projects").select("id, name, plan, demo_data").eq("id", id).single();
  const plan = data?.plan as Plan | null;
  if (!data || !plan) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <div className="sticky top-0 z-30 flex h-10 items-center justify-between gap-3 border-b bg-background/90 px-3 text-xs backdrop-blur sm:px-4">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="size-3.5" /> Preview of <b className="font-semibold text-foreground">{data.name}</b> — only you and your team can see this</span>
        <Link href={`/p/${id}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to project</Link>
      </div>
      {plan.trigger ? (
        <div className="grid flex-1 place-items-center p-4"><LiveAgent plan={plan} projectId={id} /></div>
      ) : (
        <div className="flex flex-1 flex-col p-0 sm:p-4 [&>div]:flex-1"><AppPreview plan={plan} revealed={plan.screens.length} demo={data.demo_data} projectId={id} /></div>
      )}
    </div>
  );
}
