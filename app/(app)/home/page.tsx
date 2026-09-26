import { requireUser } from "@/lib/supabase/server";
import { Composer } from "@/components/home/composer";
import { HomeShelf } from "@/components/home/home-shelf";
import { HeroTitle } from "@/components/landing/hero-title";
import type { Project } from "@/lib/types";

export default async function HomePage() {
  const { supabase, profile, user } = await requireUser();
  const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(4);
  const projects = (data ?? []) as Project[];
  const first = (profile?.full_name ?? "").split(" ")[0];

  return (
    <div>
      {/* fills the first screen (minus the top bar and the shelf: only its tab labels peek in at the bottom, a hint to scroll) */}
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem-2.6rem-4rem)] w-full max-w-2xl md:min-h-[calc(100svh-3.5rem-2.6rem)] flex-col items-center justify-center px-6 py-10 text-center">
        <HeroTitle className="text-[2.4rem] md:text-[3.2rem]" />
        <p className="mt-4 text-base text-muted-foreground md:text-lg">What should we build{first ? `, ${first}` : ""}?</p>
        <div className="mt-8 w-full"><Composer mode={profile?.default_mode ?? "builder"} /></div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-2 md:px-6"><HomeShelf projects={projects} userId={user.id} /></div>
    </div>
  );
}
