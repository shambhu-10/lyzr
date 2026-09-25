import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Check, GitFork, Lock, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { remixProject } from "@/lib/actions/community";
import { AppThumb } from "@/components/app-preview/app-thumb";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/types";

export const metadata = { title: "Remix — Architect" };

export default async function Remix({ params }: PageProps<"/remix/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data }, { data: { user } }] = await Promise.all([supabase.rpc("live_project", { p_slug: slug }), supabase.auth.getUser()]);
  const row = data?.[0] as { name: string; plan: Plan } | undefined;
  if (!row) notFound();
  const { plan } = row;
  const remix = async () => { "use server"; const r = await remixProject(slug); return void r; };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6"><Logo /><Link href={`/live/${slug}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to the app</Link></header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 pt-6 pb-16 sm:px-6 md:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border bg-muted/40 p-3 shadow-[var(--shadow-lift)]"><AppThumb plan={plan} className="rounded-lg border" /></div>
        <div>
          <div className="text-xs font-medium tracking-wide text-brand uppercase">Remix</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Make your own {row.name}</h1>
          <p className="mt-2 text-muted-foreground">{plan.tagline}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {plan.trigger
              ? <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> Runs from a {plan.trigger.kind} trigger, with {plan.guardrails?.length ?? 0} guardrails and {plan.tests?.length ?? 0} test cases</li>
              : <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> {plan.screens.length} screens, ready to edit: {plan.screens.map((s) => s.name).join(", ")}</li>}
            <li className="flex gap-2"><Bot className="mt-0.5 size-4 shrink-0 text-brand" /> {plan.agents.map((a) => a.name).join(", ")}</li>
            {plan.connections.length > 0 && <li className="flex gap-2"><Plug className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> You&apos;ll connect your own: {plan.connections.map((c) => c.name).join(", ")}</li>}
            <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> Nothing from the original owner&apos;s data or accounts is copied.</li>
          </ul>
          {user ? (
            <form action={remix} className="mt-6"><Button size="lg" className="w-full"><GitFork /> Remix into my workspace</Button></form>
          ) : (
            <Button asChild size="lg" className="mt-6 w-full"><Link href={`/login?next=/remix/${slug}`}><GitFork /> Sign in to remix — it&apos;s free</Link></Button>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">You&apos;ll land on the Connect step; building costs about ${plan.estimate.credits.toFixed(2)} in AI.</p>
        </div>
      </main>
    </div>
  );
}
