"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Clock, Database, Loader2, Lock, Pencil, Plug, Plus, Sparkles, Undo2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { filesFor } from "@/lib/script/files";
import { parseAgentsMd } from "@/lib/agents-md";
import { estimate } from "@/lib/ai/estimate";
import type { Mode, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Click-to-edit text. Enter (or blur) commits, Esc cancels. */
function Editable({ value, onChange, editable, multiline, className, placeholder, label }: {
  value: string; onChange: (v: string) => void; editable: boolean; multiline?: boolean; className?: string; placeholder?: string; label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editable) return <span className={className}>{value || <span className="text-muted-foreground">{placeholder}</span>}</span>;
  if (!editing)
    return (
      <button type="button" aria-label={`Edit ${label}`} onClick={() => { setDraft(value); setEditing(true); }}
        className={cn("-mx-1 rounded px-1 text-left decoration-dashed decoration-foreground/25 underline-offset-4 transition hover:bg-brand-soft/60 hover:underline", className)}>
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    );
  const commit = () => { setEditing(false); if (draft.trim() !== value) onChange(draft.trim()); };
  const common = {
    ref, value: draft, "aria-label": label, placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); } },
    className: cn("w-full rounded-md border border-brand/40 bg-background px-1.5 py-0.5 outline-none ring-3 ring-brand/15", className),
  };
  return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
}

export function PlanPanel({ plan, mode, framework, busy, canApprove, canEdit, onApprove, onAddBack, onSave, actual }: {
  plan: Plan | null; mode: Mode; framework: string; busy: boolean; canApprove: boolean; canEdit: boolean; actual?: { spent: number; seconds?: number };
  onApprove: () => void; onAddBack: (item: string) => void; onSave: (p: Plan, via: "inline" | "agents-md") => Promise<boolean>;
}) {
  const [view, setView] = useState<"readable" | "md">("readable");
  const [md, setMd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Plan[]>([]);

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

  const save = async (next: Plan) => {
    setHistory((h) => [plan, ...h].slice(0, 20));
    setSaving(true);
    const ok = await onSave({ ...next, estimate: estimate(next) }, "inline");
    setSaving(false);
    if (!ok) setHistory((h) => h.slice(1));
  };
  const edit = <K extends keyof Plan>(key: K, value: Plan[K]) => save({ ...plan, [key]: value });
  const inV1 = plan.scope.map((s, i) => ({ s, i })).filter((x) => x.s.status === "in");
  const later = plan.scope.map((s, i) => ({ s, i })).filter((x) => x.s.status === "later");
  const setScope = (i: number, patch: Partial<Plan["scope"][number]>) => edit("scope", plan.scope.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const agentsMd = filesFor(plan, framework)[0].content;

  return (
    <div className="@container mx-auto max-w-3xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Plan {canEdit ? <span className="flex items-center gap-1 normal-case"><Pencil className="size-3" /> click any text to edit</span> : <span className="flex items-center gap-1 normal-case"><Lock className="size-3" /> locked after build — ask Architect for changes</span>}
            {saving && <Loader2 className="size-3 animate-spin" />}
          </div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight"><Editable label="app name" value={plan.name} onChange={(v) => edit("name", v)} editable={canEdit} /></h2>
          <p className="mt-1 text-muted-foreground"><Editable label="tagline" value={plan.tagline} onChange={(v) => edit("tagline", v)} editable={canEdit} placeholder="Add a tagline" /></p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && history.length > 0 && <Button size="xs" variant="ghost" onClick={async () => { const [prev, ...rest] = history; setHistory(rest); setSaving(true); await onSave(prev, "inline"); setSaving(false); }}><Undo2 /> Undo</Button>}
          {mode === "developer" && (
            <div className="flex rounded-lg bg-muted p-0.5 text-xs">
              <button onClick={() => setView("readable")} className={cn("rounded-md px-2.5 py-1", view === "readable" && "bg-background shadow-sm")}>Readable</button>
              <button onClick={() => { setView("md"); setMd(null); }} className={cn("rounded-md px-2.5 py-1", view === "md" && "bg-background shadow-sm")}>AGENTS.md</button>
            </div>
          )}
        </div>
      </div>

      {view === "md" && mode === "developer" ? (
        <div className="space-y-3">
          <textarea value={md ?? agentsMd} onChange={(e) => setMd(e.target.value)} readOnly={!canEdit} spellCheck={false} aria-label="AGENTS.md"
            className="h-[480px] w-full resize-y rounded-xl bg-[oklch(0.18_0.01_260)] p-5 font-mono text-xs leading-6 text-[oklch(0.9_0_0)] outline-none focus:ring-3 focus:ring-dev/30" />
          {canEdit && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Edit scope (<code>- [x]</code> in v1, <code>- [ ]</code> later), screens and agents, then apply. The plan updates from this file.</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={md === null} onClick={() => setMd(null)}>Discard</Button>
                <Button size="sm" disabled={md === null || saving} onClick={async () => {
                  const { plan: next, warnings } = parseAgentsMd(md!, plan);
                  warnings.forEach((w) => toast.warning(w));
                  setHistory((h) => [plan, ...h].slice(0, 20));
                  setSaving(true);
                  const ok = await onSave(next, "agents-md");
                  setSaving(false);
                  if (ok) { setMd(null); toast.success("Plan updated from AGENTS.md"); }
                }}>{saving && <Loader2 className="animate-spin" />} Apply to plan</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="leading-relaxed"><Editable label="summary" multiline value={plan.summary} onChange={(v) => edit("summary", v)} editable={canEdit} className="block w-full" /></div>

          <section>
            <h3 className="text-sm font-semibold">What&apos;s in v1 — and what&apos;s later</h3>
            <p className="mt-1 text-xs text-muted-foreground">Everything you asked for is listed. Nothing is dropped silently.</p>
            <div className="mt-3 grid gap-3 @lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs font-medium text-success">In v1 · {inV1.length}</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {inV1.map(({ s, i }) => (
                    <li key={i} className="group flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <span className="flex-1"><Editable label="scope item" value={s.item} onChange={(v) => setScope(i, { item: v })} editable={canEdit} /></span>
                      {canEdit && <button onClick={() => setScope(i, { status: "later", reason: "Moved to later by you." })} className="shrink-0 rounded border px-1.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted">later</button>}
                      {canEdit && <button aria-label="Remove" onClick={() => edit("scope", plan.scope.filter((_, k) => k !== i))} className="text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                    </li>
                  ))}
                </ul>
                {canEdit && <button onClick={() => edit("scope", [...plan.scope, { item: "New feature", status: "in", reason: "" }])} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Add to v1</button>}
              </div>
              <div className="rounded-xl border border-dashed bg-card/50 p-4">
                <div className="text-xs font-medium text-muted-foreground">Later · {later.length}</div>
                <ul className="mt-2 space-y-3 text-sm">
                  {later.length ? later.map(({ s, i }) => (
                    <li key={i}>
                      <div className="flex items-start justify-between gap-2">
                        <Editable label="deferred item" value={s.item} onChange={(v) => setScope(i, { item: v })} editable={canEdit} />
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
                <div key={i} className="group relative overflow-hidden rounded-xl border bg-card">
                  {canEdit && plan.screens.length > 1 && <button aria-label={`Remove ${s.name}`} onClick={() => edit("screens", plan.screens.filter((_, k) => k !== i))} className="absolute top-1.5 right-1.5 z-10 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                  <div className="grid h-20 grid-cols-[1fr_3fr] gap-1.5 bg-muted/60 p-2">
                    <div className="rounded bg-background/80" />
                    <div className="space-y-1.5"><div className="h-2 w-1/2 rounded bg-foreground/15" /><div className={cn("h-9 rounded bg-background/80", i === 1 && "grid grid-cols-2 gap-1 bg-transparent")}>{i === 1 && <><div className="rounded bg-background/80" /><div className="rounded bg-brand-soft" /></>}</div></div>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <div className="text-sm font-medium"><Editable label="screen name" value={s.name} onChange={(v) => edit("screens", plan.screens.map((x, k) => (k === i ? { ...x, name: v } : x)))} editable={canEdit} /></div>
                    <div className="text-xs text-muted-foreground"><Editable label="screen purpose" value={s.purpose} onChange={(v) => edit("screens", plan.screens.map((x, k) => (k === i ? { ...x, purpose: v } : x)))} editable={canEdit} /></div>
                  </div>
                </div>
              ))}
              {canEdit && plan.screens.length < 8 && (
                <button onClick={() => edit("screens", [...plan.screens, { name: "New screen", purpose: "What this screen is for" }])} className="grid min-h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted/50"><span className="flex items-center gap-1"><Plus className="size-4" /> Add screen</span></button>
              )}
            </div>
          </section>

          <section className="grid gap-3 @lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-brand" />Agents</div>
              <ul className="mt-2 space-y-2 text-sm">
                {plan.agents.map((a, i) => (
                  <li key={i} className="group">
                    <div className="flex items-start justify-between gap-2 font-medium">
                      <Editable label="agent name" value={a.name} onChange={(v) => edit("agents", plan.agents.map((x, k) => (k === i ? { ...x, name: v } : x)))} editable={canEdit} />
                      {canEdit && plan.agents.length > 1 && <button aria-label={`Remove ${a.name}`} onClick={() => edit("agents", plan.agents.filter((_, k) => k !== i))} className="text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                    </div>
                    <div className="text-xs text-muted-foreground"><Editable label="agent role" value={a.role} onChange={(v) => edit("agents", plan.agents.map((x, k) => (k === i ? { ...x, role: v } : x)))} editable={canEdit} /></div>
                  </li>
                ))}
              </ul>
              {canEdit && plan.agents.length < 6 && <button onClick={() => edit("agents", [...plan.agents, { name: "New Agent", role: "What this agent does", tools: [] }])} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Add agent</button>}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-brand" />What it saves</div>
              <ul className="mt-2 space-y-1 text-sm">
                {plan.data.map((d, i) => (
                  <li key={i} className="group flex items-start gap-1.5">• <span className="flex-1"><Editable label="stored data" value={d} onChange={(v) => edit("data", plan.data.map((x, k) => (k === i ? v : x)))} editable={canEdit} /></span>
                    {canEdit && <button aria-label="Remove" onClick={() => edit("data", plan.data.filter((_, k) => k !== i))} className="text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                  </li>
                ))}
                {!plan.data.length && <li className="text-muted-foreground">Nothing — each run is fresh and private.</li>}
              </ul>
              {canEdit && <button onClick={() => edit("data", [...plan.data, "Something to save"])} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Save something</button>}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Plug className="size-4 text-brand" />To work on your real data, it needs</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {plan.connections.length ? plan.connections.map((c, i) => (
                <li key={c.id} className="group flex items-start gap-2"><span className="flex-1"><b className="font-medium">{c.name}</b> <span className="text-muted-foreground">— {c.why}</span></span>
                  {canEdit && <button aria-label={`Remove ${c.name}`} onClick={() => edit("connections", plan.connections.filter((_, k) => k !== i))} className="text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                </li>
              )) : <li className="text-muted-foreground">No external accounts needed.</li>}
            </ul>
            {plan.connections.length > 0 && <p className="mt-2 text-xs text-muted-foreground">You&apos;ll connect these in the next step — before anything is built.</p>}
          </section>
        </>
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        {actual ? (
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-2"><Wallet className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Spent so far</span><b>${actual.spent.toFixed(2)}</b></span></span>
            {!!actual.seconds && <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Built in</span><b>{actual.seconds < 90 ? `${actual.seconds}s` : `${Math.round(actual.seconds / 60)} min`}</b></span></span>}
          </div>
        ) : (
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-2"><Wallet className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Estimated cost</span><b>~${plan.estimate.credits.toFixed(2)}</b></span></span>
            <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span><span className="block text-xs text-muted-foreground">Build time</span><b>~{plan.estimate.minutes} min</b></span></span>
          </div>
        )}
        {canApprove ? (
          <Button size="lg" onClick={onApprove} disabled={busy || saving}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Approve plan</Button>
        ) : <span className="text-xs text-muted-foreground">Plan approved ✓ — you can still change it by chatting.</span>}
      </div>
    </div>
  );
}
