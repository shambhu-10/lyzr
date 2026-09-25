"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Check, Copy, ExternalLink, KeyRound, Loader2, Pause, Play, Plug, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentDialog } from "@/components/connect/consent-dialog";
import { connectGoogleCalendar } from "@/components/connect/google-calendar";
import { integrationById, type Integration } from "@/lib/integrations";
import type { BuildStep, Check as TestCheck } from "@/lib/script/build";
import type { Mode, Plan, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { projectSpend } from "@/lib/usage";
import { useOrigin } from "@/hooks/use-origin";

function Card({ title, icon, children, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "dev" }) {
  return (
    <div className={cn("rise overflow-hidden rounded-xl border bg-card", tone === "dev" && "border-dev/20")}>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium">{icon}{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ---------------- Connect ---------------- */

export function ConnectCard({ plan, project, onSet, onStart, reusable = [] }: {
  plan: Plan; project: Project; onSet: (id: string, s: "connected" | "sample") => Promise<void>; onStart: () => void; reusable?: string[];
}) {
  const [consent, setConsent] = useState<Integration | null>(null);
  const [keyFor, setKeyFor] = useState<string | null>(null);
  const status = project.connections;
  const pending = plan.connections.filter((c) => !status[c.id]);

  return (
    <Card title="Connect your accounts" icon={<Plug className="size-3.5 text-brand" />}>
      {plan.connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">This app doesn&apos;t need any external accounts. You&apos;re ready to build.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">So <b className="text-foreground">{plan.name}</b> works on your real data from the first run:</p>
          <ul className="space-y-2">
            {plan.connections.map((c) => {
              const s = status[c.id];
              const integ = integrationById(c.id);
              return (
                <li key={c.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white" style={{ background: integ?.color ?? "#64748b" }}>
                      {c.kind === "apikey" ? <KeyRound className="size-3.5" /> : c.name[0]}
                    </span>
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.why}</div></div>
                    {s === "connected" && <span className="flex items-center gap-1 text-xs text-success"><Check className="size-3.5" />Connected{c.id === "google-calendar" && " · real"}</span>}
                    {s === "sample" && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px]">Sample data</span>}
                  </div>
                  {!s && reusable.includes(c.id) && (
                    <div className="mt-2 flex gap-2 pl-9">
                      <Button size="xs" onClick={async () => { await onSet(c.id, "connected"); toast.success(`Using your connected ${c.name}`); }}><Check /> Use connected account</Button>
                      <Button size="xs" variant="ghost" onClick={() => onSet(c.id, "sample")}>Use sample data</Button>
                    </div>
                  )}
                  {!s && !reusable.includes(c.id) && (
                    <div className="mt-2 flex gap-2 pl-9">
                      <Button size="xs" onClick={async () => {
                        if (c.id === "google-calendar") { const err = await connectGoogleCalendar(`/p/${project.id}`, project.id); if (err) toast.error(err); return; }
                        if (c.kind === "oauth" && integ) setConsent(integ); else setKeyFor(c.id);
                      }}>{c.kind === "oauth" ? "Connect" : "Add key"}</Button>
                      <Button size="xs" variant="ghost" onClick={() => onSet(c.id, "sample")}>Use sample data for now</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Button className="mt-3 w-full" disabled={pending.length > 0} onClick={onStart}>
        {pending.length ? `Connect or skip ${pending.length} more to continue` : `Start build · ~$${plan.estimate.credits.toFixed(2)} · ~${plan.estimate.minutes} min`}
      </Button>
      {project.demo_data && !pending.length && <p className="mt-2 text-[11px] text-muted-foreground">Your app will show a “Demo data” badge until you connect real accounts. You can do that anytime.</p>}

      <ConsentDialog integration={consent} open={!!consent} onOpenChange={(o) => !o && setConsent(null)}
        onAllow={async () => { if (consent) { await onSet(consent.id, "connected"); toast.success(`${consent.name} connected`); } }} />
      <Dialog open={!!keyFor} onOpenChange={(o) => !o && setKeyFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add {keyFor}</DialogTitle><DialogDescription>Stored in your encrypted vault and injected at runtime. Never paste keys into chat.</DialogDescription></DialogHeader>
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (keyFor) await onSet(keyFor, "connected"); setKeyFor(null); toast.success("Key saved to vault"); }}>
            <Input type="password" required placeholder="sk-…" autoComplete="off" />
            <p className="text-[11px] text-muted-foreground">Prototype: the value is not stored.</p>
            <div className="flex justify-end"><Button type="submit">Save to vault</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Build ---------------- */

export function BuildCard({ steps, at, mode, paused, onPause, remaining, waitingForAI, focus }: { steps: BuildStep[]; at: number; mode: Mode; paused: boolean; onPause: () => void; remaining: number; waitingForAI?: boolean; focus?: React.ReactNode }) {
  const pct = Math.round((Math.min(at, steps.length) / steps.length) * 100);
  const done = at >= steps.length;
  if (mode === "developer")
    return (
      <Card title={done ? "Build complete" : "Building"} icon={<Terminal className="size-3.5 text-dev" />} tone="dev">
        <ul className="space-y-1.5 font-mono text-[11px]">
          {steps.slice(0, at + 1).map((s, i) => (
            <li key={s.id}>
              <div className={cn("flex items-center gap-2", i === at && !done && "text-foreground", i < at && "text-muted-foreground")}>
                {i < at ? (s.fix ? <AlertTriangle className="size-3 text-warning" /> : <Check className="size-3 text-success" />) : <Loader2 className="size-3 animate-spin" />}
                <span className="truncate">{s.dev}</span>
              </div>
              {s.diff && i <= at && (
                <div className="mt-1 ml-5 overflow-hidden rounded border text-[10.5px]">
                  {s.diff.remove.map((l) => <div key={l} className="bg-destructive/10 px-2 text-destructive">- {l}</div>)}
                  {s.diff.add.map((l) => <div key={l} className="bg-success/10 px-2 text-success">+ {l}</div>)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!done && <Button size="xs" variant="outline" className="mt-3" onClick={onPause}>{paused ? <><Play /> Resume AI</> : <><Pause /> Pause AI &amp; edit by hand</>}</Button>}
        {focus}
      </Card>
    );
  return (
    <Card title={done ? "Your app is built" : "Building your app"} icon={done ? <Check className="size-3.5 text-success" /> : <Loader2 className="size-3.5 animate-spin text-brand" />}>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Step {Math.min(at + 1, steps.length)} of {steps.length}</span><span>{done ? "Done" : waitingForAI ? "AI is designing your screens…" : `about ${remaining}s left`}</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={s.id} className={cn("flex items-center gap-2", i > at && "text-muted-foreground/60")}>
            {i < at ? (s.fix ? <Check className="size-3.5 text-warning" /> : <Check className="size-3.5 text-success" />) : i === at && !done ? <Loader2 className="size-3.5 animate-spin text-brand" /> : <span className="size-3.5 rounded-full border" />}
            <span className={cn(s.fix && i <= at && "text-foreground")}>{s.label}</span>
          </li>
        ))}
      </ul>
      {focus}
      {!done && <p className="mt-3 text-[11px] text-muted-foreground">You can switch tabs — we&apos;ll notify you when it&apos;s ready. Screens are designed live by AI; the rest of the pipeline is simulated in this prototype.</p>}
    </Card>
  );
}

/* ---------------- Test ---------------- */

export function TestCard({ checks, mode, onFix, onPlayground, onContinue }: { checks: TestCheck[]; mode: Mode; onFix: () => void; onPlayground: () => void; onContinue: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= checks.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 550);
    return () => clearTimeout(t);
  }, [shown, checks.length]);
  const done = shown >= checks.length;
  const passed = checks.filter((c) => c.ok === true).length;
  return (
    <Card title={done ? `${passed} of ${checks.length} checks passed` : "Testing your app…"} icon={<ShieldCheck className="size-3.5 text-brand" />}>
      <ul className="space-y-2 text-sm">
        {checks.map((c, i) => (
          <li key={c.label} className={cn("flex items-start gap-2", i >= shown && "opacity-40")}>
            {i >= shown ? <Loader2 className={cn("mt-0.5 size-3.5", i === shown && "animate-spin")} /> : c.ok === true ? <Check className="mt-0.5 size-3.5 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 text-warning" />}
            <span className="flex-1">{mode === "developer" ? <span className="font-mono text-xs">{c.dev}</span> : c.label}</span>
            {c.fix && i < shown && <Button size="xs" variant="outline" onClick={onFix}>{c.fix}</Button>}
          </li>
        ))}
      </ul>
      {done && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onPlayground}>Talk to your agent</Button>
          <Button size="sm" onClick={onContinue}>Continue to Ship</Button>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Ship ---------------- */

export function ShipCard({ project, onDeploy, onFixConnections }: { project: Project; onDeploy: (t: "preview" | "production") => Promise<void>; onFixConnections: () => void }) {
  const [target, setTarget] = useState<"preview" | "production">("production");
  const [phase, setPhase] = useState(-1);
  const PHASES = ["Building for production", "Uploading assets", "Setting up secure domain", "Going live"];
  const checks = [
    { label: "Security scan — data locked to each user (row-level security)", ok: true },
    { label: "Secrets stored in vault, none in code", ok: true },
    { label: "Accessibility — contrast & keyboard navigation", ok: true },
    { label: project.demo_data ? "Still using sample data" : "Real accounts connected", ok: !project.demo_data },
  ];
  const deploy = async () => {
    for (let i = 0; i < PHASES.length; i++) { setPhase(i); await new Promise((r) => setTimeout(r, 900)); }
    await onDeploy(target);
    setPhase(-1);
  };
  return (
    <Card title="Ready to ship" icon={<Rocket className="size-3.5 text-brand" />}>
      <div className="text-xs font-medium text-muted-foreground">Pre-flight check</div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2">
            {c.ok ? <Check className="mt-0.5 size-3.5 text-success" /> : <AlertTriangle className="mt-0.5 size-3.5 text-warning" />}
            <span className="flex-1">{c.label}</span>
            {!c.ok && <button onClick={onFixConnections} className="text-xs underline underline-offset-2">Connect</button>}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["preview", "production"] as const).map((t) => (
          <button key={t} onClick={() => setTarget(t)} className={cn("rounded-lg border p-2 text-left text-xs", target === t && "border-brand bg-brand-soft/60")}>
            <span className="block font-medium capitalize">{t}</span>
            <span className="text-muted-foreground">{t === "preview" ? "Private link for feedback" : "Public URL for everyone"}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center rounded-lg border bg-background px-2 text-xs"><span className="text-muted-foreground">https://</span><input defaultValue={project.slug} className="min-w-0 flex-1 bg-transparent py-1.5 font-mono outline-none" aria-label="Subdomain" /><span className="text-muted-foreground">.architect.app</span></div>
      <button className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2" onClick={() => toast("Custom domains: add a CNAME to cname.architect.app, we handle SSL.")}>Use my own domain</button>
      {project.demo_data && target === "production" && <p className="mt-2 rounded-md bg-warning-soft p-2 text-[11px]">Heads up: visitors will see sample data until you connect real accounts.</p>}
      <Button className="mt-3 w-full" disabled={phase >= 0} onClick={deploy}>
        {phase >= 0 ? <><Loader2 className="animate-spin" /> {PHASES[phase]}…</> : <><Rocket /> Deploy to {target}</>}
      </Button>
    </Card>
  );
}

/* ---------------- Live ---------------- */

export function LiveCard({ project, later, onAddBack }: { project: Project; later: string[]; onAddBack: (s: string) => void }) {
  const url = `${useOrigin()}/live/${project.slug}`;
  return (
    <Card title="Live" icon={<span className="size-2 rounded-full bg-success" />}>
      <div className="flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
        <span className="flex-1 truncate font-mono">{url}</span>
        <Button size="icon-xs" variant="ghost" aria-label="Copy link" onClick={() => { navigator.clipboard.writeText(url); toast("Link copied"); }}><Copy /></Button>
        <Button size="icon-xs" variant="ghost" asChild aria-label="Open live app"><a href={`/live/${project.slug}`} target="_blank"><ExternalLink /></a></Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">0</div>visitors</div>
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">0</div>agent runs</div>
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">${projectSpend(project).toFixed(2)}</div>total spent</div>
      </div>
      {later.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><BarChart3 className="size-3.5" />Next up from your plan</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{later.map((l) => <button key={l} onClick={() => onAddBack(l)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">+ {l}</button>)}</div>
        </div>
      )}
    </Card>
  );
}
