"use client";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Code2, Headphones, LayoutGrid, LineChart, Loader2, Megaphone, Scale, Search, Sparkles, TrendingUp, Users, Wallet, CalendarCheck } from "lucide-react";
import { createProject } from "@/lib/actions/projects";
import { TEMPLATES } from "@/lib/explore";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof LineChart> = {
  General: Sparkles, Analysts: LineChart, Marketing: Megaphone, Sales: TrendingUp, Legal: Scale, HR: Users,
  Support: Headphones, Productivity: CalendarCheck, Finance: Wallet, Developers: Code2,
};
const ORDER = ["General", "Analysts", "Marketing", "Sales", "Legal", "HR", "Support", "Productivity", "Finance", "Developers"];

/** Prompt library: filter by team, search, and start a project from any prompt in one click. */
export function TemplateLibrary({ className }: { className?: string }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const cats = ["All", ...ORDER.filter((c) => TEMPLATES.some((t) => t.cat === c))];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TEMPLATES.filter((t) => (cat === "All" || t.cat === cat) && (!s || `${t.title} ${t.prompt} ${t.cat}`.toLowerCase().includes(s)));
  }, [cat, q]);
  return (
    <div className={className}>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {cats.map((c) => { const Icon = c === "All" ? LayoutGrid : ICON[c] ?? Sparkles; return (
          <button key={c} onClick={() => setCat(c)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground", cat === c && "border-foreground/20 bg-muted font-medium text-foreground")}>
            <Icon className="size-3.5" />{c === "All" ? "All prompts" : c}
          </button>
        ); })}
      </div>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm"><Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" aria-label="Search prompts" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
      {list.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <form key={t.title} action={createProject}>
              <input type="hidden" name="prompt" value={t.prompt} />
              <input type="hidden" name="template" value="1" />
              <Card title={t.title} prompt={t.prompt} Icon={ICON[t.cat] ?? Sparkles} />
            </form>
          ))}
        </div>
      ) : <p className="mt-6 text-center text-sm text-muted-foreground">No prompts match “{q}”.</p>}
    </div>
  );
}

function Card({ title, prompt, Icon }: { title: string; prompt: string; Icon: typeof LineChart }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title="Start a project from this prompt"
      className="group h-full w-full rounded-2xl border bg-card p-5 text-left transition hover:border-foreground/20 hover:bg-muted/40 disabled:opacity-70">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">{pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}</span>
        <span className="font-semibold tracking-tight">{title}</span>
      </div>
      <p className="mt-3 ml-12 line-clamp-3 border-l-2 pl-3 font-mono text-xs leading-5 text-muted-foreground">{prompt}</p>
    </button>
  );
}
