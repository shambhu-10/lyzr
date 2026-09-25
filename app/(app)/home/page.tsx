import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Composer } from "@/components/home/composer";
import { ProjectCard } from "@/components/projects/project-card";
import { roleById } from "@/lib/roles";
import { UsePromptButton } from "@/components/explore/use-prompt-button";
import { TEMPLATES } from "@/lib/explore";
import type { Project } from "@/lib/types";

export default async function HomePage() {
  const { supabase, profile } = await requireUser();
  const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(4);
  const projects = (data ?? []) as Project[];
  const role = roleById(profile?.role);
  const first = (profile?.full_name ?? "").split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-6 pt-16 pb-24 md:pt-24">
      <h1 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
        {first ? `Welcome back, ${first}.` : "Welcome."} <span className="font-display font-normal italic text-muted-foreground">What should we build?</span>
      </h1>
      <div className="mt-10"><Composer mode={profile?.default_mode ?? "builder"} suggestions={[...role.ideas]} /></div>

      <section className="mt-16">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Continue where you left off</h2>
          {projects.length > 0 && <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">All projects <ArrowRight className="size-3.5" /></Link>}
        </div>
        {projects.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p>Your projects will show up here. New to Architect? Open a ready-made sample and click around — nothing to set up.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <UsePromptButton prompt={TEMPLATES[1].prompt} label="Try the sample project (Briefly)" variant="default" />
              <Link href="/explore" className="inline-flex h-7 items-center rounded-lg border px-2.5 text-[0.8rem] text-foreground hover:bg-muted">Browse templates</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
