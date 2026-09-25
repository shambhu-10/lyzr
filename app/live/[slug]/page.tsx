import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppPreview } from "@/components/app-preview/app-preview";
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
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F2EC]">
      <div className="flex flex-1 flex-col p-0 sm:p-4 [&>div]:flex-1"><AppPreview plan={row.plan} revealed={row.plan.screens.length} demo={row.demo_data} slug={slug} /></div>
      <Link href="/" className="mx-auto mb-3 rounded-full bg-black/80 px-3 py-1 text-[11px] text-white">Built with Architect</Link>
    </div>
  );
}
