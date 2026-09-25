import Link from "next/link";
import { BookOpen, GraduationCap, MessageCircle, Repeat2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UsePromptButton } from "@/components/explore/use-prompt-button";
import { Consultant } from "@/components/explore/consultant";
import { COMMUNITY, LEARN, TEMPLATES } from "@/lib/explore";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "templates", label: "Templates" },
  { id: "community", label: "Community apps" },
  { id: "consultant", label: "What should I build?" },
  { id: "learn", label: "Learn" },
] as const;

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "templates";
  const { profile } = await requireUser();

  return (
    <>
      <PageHeader title="Explore" description="Templates, community apps, ideas and guides — everything to get you started, in one place." />
      <div className="px-6 md:px-10">
        <nav className="flex gap-5 overflow-x-auto border-b text-sm" aria-label="Explore sections">
          {TABS.map((t) => (
            <Link key={t.id} href={`/explore?tab=${t.id}`} className={cn("-mb-px border-b-2 border-transparent py-3 whitespace-nowrap text-muted-foreground hover:text-foreground", tab === t.id && "border-foreground font-medium text-foreground")}>{t.label}</Link>
          ))}
        </nav>
        <div className="py-8">
          {tab === "templates" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((t) => (
                <div key={t.title} className="flex flex-col rounded-xl border bg-card p-4">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t.cat}</span>
                  <div className="mt-2 font-medium">{t.title}</div>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.desc}</p>
                  <div className="mt-3 flex flex-wrap gap-1">{t.tools.map((x) => <span key={x} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{x}</span>)}</div>
                  <div className="mt-4"><UsePromptButton prompt={t.prompt} /></div>
                </div>
              ))}
            </div>
          )}
          {tab === "community" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {COMMUNITY.map((c) => (
                <div key={c.name} className="overflow-hidden rounded-xl border bg-card">
                  <div className="h-32 bg-[linear-gradient(135deg,var(--dev-soft),var(--brand-soft))]" />
                  <div className="p-4">
                    <div className="flex items-center justify-between"><span className="font-medium">{c.name}</span><span className="text-[11px] text-muted-foreground">{c.cat}</span></div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>by {c.author} · <Repeat2 className="inline size-3.5" /> {c.remixes} remixes</span>
                      <UsePromptButton prompt={`Remix “${c.name}”: ${c.desc}`} label="Remix" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === "consultant" && <Consultant role={profile?.role ?? "product"} />}
          {tab === "learn" && (
            <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
              <div className="divide-y rounded-xl border bg-card">
                {LEARN.map((l) => (
                  <a key={l.title} href="#" className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                    <span className="flex items-center gap-3"><BookOpen className="size-4 text-muted-foreground" />{l.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{l.kind} · {l.mins} min</span>
                  </a>
                ))}
              </div>
              <div className="space-y-3">
                {[{ i: GraduationCap, t: "Lyzr University", d: "Structured courses on building agents." }, { i: MessageCircle, t: "Community Discord", d: "Ask questions, share what you built." }, { i: BookOpen, t: "Documentation", d: "Reference for every feature." }].map((x) => (
                  <a key={x.t} href="#" className="flex gap-3 rounded-xl border bg-card p-4 hover:border-foreground/20">
                    <x.i className="size-5 text-brand" /><span><span className="block font-medium">{x.t}</span><span className="text-sm text-muted-foreground">{x.d}</span></span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
