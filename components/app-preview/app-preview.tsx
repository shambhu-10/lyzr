"use client";
import { useState } from "react";
import { ArrowRight, Bot, Calendar, CheckCircle2, Copy, Loader2, Sparkles, Users } from "lucide-react";
import type { Plan } from "@/lib/types";
import { SAMPLE_AGENDA, SAMPLE_MEETING } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

/**
 * Renders the generated app from its plan. Used in the workspace preview (screens assemble as the build reveals them)
 * and on /live/[slug]. Briefly has a hand-polished path; any other plan gets a generic but plan-driven layout.
 */
export function AppPreview({ plan, revealed, demo, building }: { plan: Plan; revealed: number; demo: boolean; building?: boolean }) {
  const [screen, setScreen] = useState(0);
  const briefly = /meeting|calendar|brief/i.test(plan.name + plan.summary);
  const active = Math.min(screen, Math.max(0, revealed - 1));
  const ready = active < revealed;

  return (
    <div className="@container flex h-full min-h-[520px] overflow-hidden rounded-xl border bg-[#FBFAF7] text-[#1F2430] shadow-sm">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-black/5 bg-white p-4 @3xl:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-[#139C8E] text-sm text-white">{plan.name[0]}</span>
          {plan.name}
        </div>
        <nav className="mt-6 space-y-1 text-sm">
          {plan.screens.map((s, i) => (
            <button key={s.name} disabled={i >= revealed} onClick={() => setScreen(i)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition", i === active ? "bg-[#139C8E]/10 font-medium text-[#0E7C71]" : "text-black/60 hover:bg-black/5", i >= revealed && "opacity-40")}>
              {i >= revealed && building ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              {s.name}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-black/5 bg-[#F4F7F6] p-3 text-xs">
          {plan.agents.map((a) => (
            <div key={a.name} className="flex items-center gap-2"><Bot className="size-3.5 text-[#139C8E]" /><span className="truncate font-medium">{a.name}</span></div>
          ))}
          <div className="mt-1 flex items-center gap-1.5 text-[10px] tracking-wide text-[#139C8E] uppercase"><span className="size-1.5 rounded-full bg-[#139C8E]" /> Ready</div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {demo && (
          <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
            <span><b>Demo data.</b> This app is showing sample data — connect your real accounts to go live.</span>
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto border-b border-black/5 bg-white px-3 py-2 @3xl:hidden">
          {plan.screens.map((s, i) => (
            <button key={s.name} disabled={i >= revealed} onClick={() => setScreen(i)}
              className={cn("rounded-full px-3 py-1 text-xs whitespace-nowrap", i === active ? "bg-[#139C8E]/10 font-medium text-[#0E7C71]" : "text-black/55", i >= revealed && "opacity-40")}>{s.name}</button>
          ))}
        </div>
        <div className="p-5 @3xl:p-8">
          {!ready ? <SkeletonScreen /> : briefly ? <BrieflyScreen i={active} onNext={() => setScreen(Math.min(active + 1, revealed - 1))} /> : <GenericScreen plan={plan} i={active} />}
        </div>
      </main>
    </div>
  );
}

function SkeletonScreen() {
  return (
    <div className="space-y-4" aria-label="Screen is being built">
      <div className="h-7 w-1/3 rounded shimmer" />
      <div className="h-4 w-1/2 rounded shimmer" />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl shimmer" />)}</div>
      <div className="h-48 rounded-xl shimmer" />
    </div>
  );
}

function Title({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <header className="rise">
      <div className="text-[11px] font-medium tracking-[.14em] text-black/45 uppercase">{eyebrow}</div>
      <h1 className="mt-1 font-display text-4xl leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-black/55">{sub}</p>
    </header>
  );
}

function BrieflyScreen({ i, onNext }: { i: number; onNext: () => void }) {
  const [focus, setFocus] = useState("Highlight capacity risks and the decisions we need to leave with.");
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  if (i === 0)
    return (
      <div className="space-y-6">
        <Title eyebrow="Today" title="Your meetings" sub="Pick a meeting to prepare a brief. Nothing is added to your calendar." />
        <div className="rise divide-y divide-black/5 rounded-xl border border-black/5 bg-white">
          {SAMPLE_AGENDA.map((m, k) => (
            <button key={m.title} onClick={k === 0 ? onNext : undefined} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-black/[.02]">
              <span className="w-12 font-mono text-sm text-black/50">{m.time}</span>
              <span className="flex-1"><span className="block font-medium">{m.title}</span><span className="text-xs text-black/50">{m.who}</span></span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px]">{m.tag}</span>
              <ArrowRight className="size-4 text-black/30" />
            </button>
          ))}
        </div>
      </div>
    );
  if (i === 1)
    return (
      <div className="space-y-6">
        <Title eyebrow="Meeting context" title="Review before generating." sub="Verify the calendar facts and add an optional focus." />
        <div className="grid gap-5 @4xl:grid-cols-[1fr_300px]">
          <div className="rise rounded-xl border border-black/5 bg-white p-5">
            <div className="flex gap-2 text-[11px]"><span className="rounded-full border border-black/10 px-2 py-0.5">From Google Calendar</span><span className="rounded-full bg-[#139C8E]/10 px-2 py-0.5 text-[#0E7C71]">Confirmed</span></div>
            <h2 className="mt-3 font-display text-3xl">{SAMPLE_MEETING.title}</h2>
            <p className="text-sm text-black/55">Organized by {SAMPLE_MEETING.organizer}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2 py-1"><Calendar className="size-3.5" />{SAMPLE_MEETING.when}</span></div>
            <p className="mt-4 text-sm leading-relaxed text-black/70">{SAMPLE_MEETING.description}</p>
            <div className="mt-4 text-xs font-medium text-black/50"><Users className="mr-1 inline size-3.5" /> Attendees</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {SAMPLE_MEETING.attendees.map((a) => <li key={a.email} className="flex justify-between"><span>{a.name}</span><span className="text-xs text-black/45">{a.status}</span></li>)}
            </ul>
          </div>
          <div className="rise h-fit rounded-xl border border-black/5 bg-white p-5">
            <div className="text-[11px] tracking-wide text-black/45 uppercase">Optional</div>
            <div className="mt-1 font-medium">Shape your brief</div>
            <textarea value={focus} onChange={(e) => setFocus(e.target.value)} rows={4} className="mt-3 w-full rounded-lg border border-black/10 p-2 text-sm outline-none focus:border-[#139C8E]" aria-label="Brief focus" />
            <button onClick={() => { setState("working"); setTimeout(() => { setState("done"); onNext(); }, 1400); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#139C8E] py-2 text-sm font-medium text-white hover:opacity-90">
              {state === "working" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate brief
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      <Title eyebrow="Brief" title={SAMPLE_MEETING.title} sub={`${SAMPLE_MEETING.when} · generated by Meeting Brief Agent`} />
      <div className="rise space-y-4 rounded-xl border border-black/5 bg-white p-6 text-sm leading-relaxed">
        {[
          ["Why this meeting", "Lock Q4 priorities and decide which roadmap bets move to validation. Capacity is the constraint."],
          ["Who's in the room", "Maya (organizer, owns roadmap) · Jordan & Amira (eng leads) · Priya (design) · Noah hasn't confirmed."],
          ["Watch for", "Capacity risk: two bets compete for the same eng pod. Noah's absence may block the data-platform decision."],
          ["Questions to ask", "1. Which bet do we drop if capacity stays flat?  2. What evidence moves a bet to validation?  3. Who owns the follow-up?"],
        ].map(([h, b]) => (
          <div key={h}><div className="flex items-center justify-between font-medium">{h}<Copy className="size-3.5 cursor-pointer text-black/30 hover:text-black/60" /></div><p className="mt-1 text-black/70">{b}</p></div>
        ))}
        <div className="flex items-center gap-2 border-t border-black/5 pt-3 text-xs text-black/45"><CheckCircle2 className="size-3.5 text-[#139C8E]" /> Grounded only in the calendar event and your focus. Nothing was saved.</div>
      </div>
    </div>
  );
}

function GenericScreen({ plan, i }: { plan: Plan; i: number }) {
  const s = plan.screens[i];
  const agent = plan.agents[i % plan.agents.length];
  const [ran, setRan] = useState(false);
  const metrics = s.metrics ?? [];
  const rows = s.rows?.length ? s.rows : [{ title: "Example item", meta: "Just now" }, { title: "Another example", meta: "1h ago" }];
  return (
    <div className="space-y-6">
      <Title eyebrow={plan.name} title={s.name} sub={s.purpose} />
      {metrics.length > 0 && (
        <div className="rise grid gap-4 @xl:grid-cols-3">
          {metrics.slice(0, 3).map((m) => (
            <div key={m.label} className="rounded-xl border border-black/5 bg-white p-4"><div className="text-xs text-black/50">{m.label}</div><div className="mt-1 text-2xl font-semibold">{m.value}</div></div>
          ))}
        </div>
      )}
      <div className="rise rounded-xl border border-black/5 bg-white">
        {rows.map((r) => (
          <div key={r.title} className="flex items-center justify-between gap-4 border-b border-black/5 px-4 py-3 text-sm last:border-0">
            <span className="min-w-0 truncate">{r.title}</span><span className="shrink-0 text-xs text-black/45">{r.meta}</span>
          </div>
        ))}
      </div>
      {agent && (
        <div className="rise flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#139C8E]/20 bg-[#139C8E]/5 p-4 text-sm">
          <span className="flex items-center gap-2"><Bot className="size-4 shrink-0 text-[#139C8E]" /><span><b>{agent.name}</b> — {ran ? "done. Results are ready for your review — nothing was sent." : agent.role}</span></span>
          <button onClick={() => setRan(true)} className="rounded-lg bg-[#139C8E] px-3 py-1.5 text-xs font-medium text-white">{s.action || "Run agent"}</button>
        </div>
      )}
    </div>
  );
}
