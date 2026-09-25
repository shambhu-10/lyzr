import Link from "next/link";
import { notFound } from "next/navigation";
import { GitFork } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppPreview } from "@/components/app-preview/app-preview";
import { LogoMark } from "@/components/logo";
import { LiveAgent } from "@/components/agents/live-agent";
import type { Plan } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/live/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("live_project", { p_slug: slug });
  const row = data?.[0] as { name: string; plan: Plan } | undefined;
  return { title: row ? `${row.name} — ${row.plan.tagline}` : "Not found" };
}

export default async function LiveApp({ params }: PageProps<"/live/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("live_project", { p_slug: slug });
  const row = data?.[0] as { name: string; plan: Plan; demo_data: boolean } | undefined;
  if (!row) notFound();
  void supabase.rpc("bump_view", { p_slug: slug }).then(({ error }) => error && console.error("bump_view:", error.message));
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <div className="sticky top-0 z-30 flex h-10 items-center justify-between gap-3 border-b bg-background/90 px-3 text-xs backdrop-blur sm:px-4">
        <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><LogoMark className="size-5" /> Made with <b className="font-semibold text-foreground">Architect</b></Link>
        <Link href={`/remix/${slug}`} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground hover:opacity-90"><GitFork className="size-3" /> Remix this app</Link>
      </div>
      {row.plan.trigger ? (
        <div className="grid flex-1 place-items-center p-4"><LiveAgent plan={row.plan} slug={slug} /></div>
      ) : (
        <div className="flex flex-1 flex-col p-0 sm:p-4 [&>div]:flex-1"><AppPreview plan={row.plan} revealed={row.plan.screens.length} demo={row.demo_data} slug={slug} /></div>
      )}
    </div>
  );
}
