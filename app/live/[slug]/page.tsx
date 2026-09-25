import Link from "next/link";
import { notFound } from "next/navigation";
import { GitFork } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppPreview } from "@/components/app-preview/app-preview";
import { LogoMark } from "@/components/logo";
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
      <div className="flex flex-1 flex-col p-0 sm:p-4 [&>div]:flex-1"><AppPreview plan={row.plan} revealed={row.plan.screens.length} demo={row.demo_data} slug={slug} /></div>
      <div className="mx-auto mb-3 flex items-center overflow-hidden rounded-full bg-black/85 text-[11px] text-white shadow-lg">
        <Link href="/" className="flex items-center gap-1.5 py-1.5 pr-2.5 pl-2 hover:bg-white/10"><LogoMark className="size-4 [&_path]:stroke-black [&_rect]:fill-white" /> Made with Architect</Link>
        <Link href={`/remix/${slug}`} className="flex items-center gap-1 border-l border-white/20 py-1.5 pr-3 pl-2.5 hover:bg-white/10"><GitFork className="size-3" /> Remix</Link>
      </div>
    </div>
  );
}
