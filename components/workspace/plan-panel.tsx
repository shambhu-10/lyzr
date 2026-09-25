"use client";
import { useState } from "react";
import { Bot, Check, Clock, Database, Loader2, Plug, Plus, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesFor } from "@/lib/script/files";
import type { Mode, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlanPanel({ plan, mode, framework, busy, canApprove, onApprove, onAddBack }: {
  plan: Plan | null; mode: Mode; framework: string; busy: boolean; canApprove: boolean; onApprove: () => void; onAddBack: (item: string) => void;
}) {
  const [asCode, setAsCode] = useState(false);
  if (!plan)
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div className="max-w-sm">
          {busy ? <Loader2 className="mx-auto size-6 animate-spin text-brand" /> : <Sparkles className="mx-auto size-6 text-brand" />}
          <p className="mt-4 font-medium">{busy ? "Drafting your plan…" : "Your plan will appear here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Answer a few questions in the chat. You&apos;ll see exactly what gets built — and what it costs — before anything is built.</p>
        </div>
      </div>
    );

  const inV1 = plan.scope.filter((s) => s.status === "in");
  const later = plan.scope.filter((s) => s.status === "later");

  return (
    <div className="@container mx-auto max-w-3xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Plan</div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{plan.name}</h2>
          <p className="mt-1 text-muted-foreground">{plan.tagline}</p>
        </div>
        {mode === "developer" && (
          <div className="flex rounded-lg bg-muted p-0.5 text-xs">
            <button onClick={() => setAsCode(false)} className={cn("rounded-md px-2.5 py-1", !asCode && "bg-background shadow-sm")}>Readable</button>
            <button onClick={() => setAsCode(true)} className={cn("rounded-md px-2.5 py-1", asCode && "bg-background shadow-sm")}>AGENTS.md</button>
          </div>
        )}
      </div>

      {asCode ? (
        <pre className="overflow-x-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-5 font-mono text-xs leading-6 text-[oklch(0.9_0_0)]">{filesFor(plan, framework)[0].content}</pre>
      ) : (
        <>
          <p className="leading-relaxed">{plan.summary}</p>

          <section>
            <h3 className="text-sm font-semibold">What&apos;s in v1 — and what&apos;s later</h3>
            <p className="mt-1 text-xs text-muted-foreground">Everything you asked for is listed. Nothing is dropped silently.</p>
            <div className="mt-3 grid gap-3 @lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs font-medium text-success">In v1 · {inV1.length}</div>
                <ul className="mt-2 space-y-2 text-sm">{inV1.map((s) => <li key={s.item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{s.item}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-dashed bg-card/50 p-4">
                <div className="text-xs font-medium text-muted-foreground">Later · {later.length}</div>
                <ul className="mt-2 space-y-3 text-sm">
                  {later.length ? later.map((s) => (
                    <li key={s.item}>
                      <div className="flex items-start justify-between gap-2">
                        <span>{s.item}</span>
                        {canApprove && <button disabled={busy} onClick={() => onAddBack(s.item)} className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"><Plus className="size-3" />Add back</button>}
                      </div>
                      {s.reason && <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>}
                    </li>
                  )) : <li className="text-muted-foreground">Nothing deferred.</li>}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Screens</h3>
            <div className="mt-3 grid gap-3 @lg:grid-cols-3">
              {plan.screens.map((s, i) => (
                <div key={s.name} className="overflow-hidden rounded-xl border bg-card">
                  <div className="grid h-20 grid-cols-[1fr_3fr] gap-1.5 bg-muted/60 p-2">
                    <div className="rounded bg-background/80" />
                    <div className="space-y-1.5"><div className="h-2 w-1/2 rounded bg-foreground/15" /><div className={cn("h-9 rounded bg-background/80", i === 1 && "grid grid-cols-2 gap-1 bg-transparent")}>{i === 1 && <><div className="rounded bg-background/80" /><div className="rounded bg-brand-soft" /></>}</div></div>
                  </div>
                  <div className="p-3"><div className="text-sm font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.purpose}</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 @lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-brand" />Agents</div>
              <ul className="mt-2 space-y-2 text-sm">{plan.agents.map((a) => <li key={a.name}><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.role}</div></li>)}</ul>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-brand" />What it saves</div>
              <ul className="mt-2 space-y-1 text-sm">{plan.data.length ? plan.data.map((d) => <li key={d}>• {d}</li>) : <li className="text-muted-foreground">Nothing — each run is fresh and private.</li>}</ul>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Plug className="size-4 text-brand" />To work on your real data, it needs</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {plan.connections.length ? plan.connections.map((c) => <li key={c.id}><b className="font-medium">{c.name}</b> <span className="text-muted-foreground">— {c.why}</span></li>) : <li className="text-muted-foreground">No external accounts needed.</li>}
            </ul>
            {plan.connections.length > 0 && <p className="mt-2 text-xs text-muted-foreground">You&apos;ll connect these in the next step — before anything is built.</p>}
          </section>
        </>
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="flex gap-6 text-sm">
          <span className="flex items-center gap-2"><Wallet className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Estimated cost</span><b>~${plan.estimate.credits.toFixed(2)}</b></span></span>
          <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Build time</span><b>~{plan.estimate.minutes} min</b></span></span>
        </div>
        {canApprove ? (
          <Button size="lg" onClick={onApprove} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Approve plan</Button>
        ) : <span className="text-xs text-muted-foreground">Plan approved ✓ — you can still change it by chatting.</span>}
      </div>
    </div>
  );
}
