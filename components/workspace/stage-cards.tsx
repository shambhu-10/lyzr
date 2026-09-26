"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Check, Copy, ExternalLink, Eye, KeyRound, Loader2, Pause, Play, Plug, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsentDialog } from "@/components/connect/consent-dialog";
import { connectGoogleCalendar } from "@/components/connect/google-calendar";
import { setSecret } from "@/lib/actions/secrets";
import { addApprovalStep, moveSecretToVault, securityScan } from "@/lib/actions/security";
import { setShowcase } from "@/lib/actions/community";
import { Switch } from "@/components/ui/switch";
import type { Finding } from "@/lib/security-scan";
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

export function ConnectCard({ plan, project, onSet, onStart, reusable = [], built }: {
  plan: Plan; project: Project; onSet: (id: string, s: "connected" | "sample") => Promise<void>; onStart: () => void; reusable?: string[]; built?: boolean;
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
                    {s === "sample" && (
                      <Button size="xs" variant="outline" onClick={async () => {
                        if (c.id === "google-calendar") { const err = await connectGoogleCalendar(`/p/${project.id}`, project.id); if (err) toast.error(err); return; }
                        if (c.kind === "oauth" && integ) setConsent(integ); else setKeyFor(c.id);
                      }}>Connect</Button>
                    )}
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
      {built ? (
        <p className="mt-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">Your app is already built. Connection changes apply right away — no rebuild needed.</p>
      ) : (
        <Button className="mt-3 w-full" disabled={pending.length > 0} onClick={onStart}>
          {pending.length ? `Connect or skip ${pending.length} more to continue` : `Start build · ~$${plan.estimate.credits.toFixed(2)} · ~${plan.estimate.minutes} min`}
        </Button>
      )}
      {project.demo_data && !pending.length && <p className="mt-2 text-[11px] text-muted-foreground">Skipped accounts use sample data for now — connect them anytime; the Ship check will remind you.</p>}

      <ConsentDialog integration={consent} open={!!consent} onOpenChange={(o) => !o && setConsent(null)}
        onAllow={async () => { if (consent) { await onSet(consent.id, "connected"); toast.success(`${consent.name} connected`); } }} />
      <Dialog open={!!keyFor} onOpenChange={(o) => !o && setKeyFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add {keyFor}</DialogTitle><DialogDescription>Stored in your encrypted vault and injected at runtime. Never paste keys into chat.</DialogDescription></DialogHeader>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!keyFor) return;
            const value = String(new FormData(e.currentTarget).get("value") ?? "");
            const r = await setSecret(project.id, "all", keyFor, value);
            if ("error" in r) return toast.error(r.error);
            await onSet(keyFor, "connected"); setKeyFor(null); toast.success("Key encrypted and saved to the vault");
          }}>
            <Input name="value" type="password" required placeholder="sk-…" autoComplete="off" aria-label="Key value" />
            <p className="text-[11px] text-muted-foreground">Encrypted on the server (AES-256-GCM). Only the last 4 characters are ever shown.</p>
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

export function ShipCard({ project, mode, onDeploy, onFixConnections, onFileChanged }: {
  project: Project; mode: Mode; onDeploy: (t: "preview" | "production") => Promise<void>; onFixConnections: () => void; onFileChanged: (path: string, content: string) => void;
}) {
  const [phase, setPhase] = useState(-1);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const PHASES = ["Building for production", "Uploading assets", "Setting up secure domain", "Going live"];
  const rescan = () => securityScan(project.id).then(setFindings).catch(() => setFindings([]));
  useEffect(() => { void rescan(); }, [project.id, project.demo_data]); // eslint-disable-line react-hooks/exhaustive-deps
  const high = findings?.filter((f) => f.severity === "high") ?? [];
  const blocked = high.length > 0 && !override;

  const fix = async (f: Finding) => {
    if (f.fix === "connect") return onFixConnections();
    setFixing(f.id);
    if (f.fix === "vault" && f.file && f.line) {
      const r = await moveSecretToVault(project.id, f.file, f.line).catch(() => ({ error: "Couldn't move the secret." }));
      if ("error" in r) toast.error(r.error); else { onFileChanged(r.path, r.content); toast.success(`Moved to the vault as ${r.env} — the code now reads it safely`); }
    } else if (f.fix === "approval") {
      const r = await addApprovalStep(project.id, f.id.replace(/^agent:/, "")).catch(() => ({ error: "Couldn't update the agent." }));
      if ("error" in r) toast.error(r.error as string); else toast.success("Approval step added");
    }
    await rescan();
    setFixing(null);
  };
  const deploy = async () => {
    for (let i = 0; i < PHASES.length; i++) { setPhase(i); await new Promise((r) => setTimeout(r, 900)); }
    await onDeploy("production");
    setPhase(-1);
  };
  const passed = [
    "Data locked to each signed-in user (row-level security)",
    ...(findings && !findings.some((f) => f.rule === "hardcoded-secret") ? ["No secrets written in the code"] : []),
    ...(findings && !findings.some((f) => f.rule === "missing-env") ? ["Every key the code needs is set"] : []),
    ...(findings && !findings.some((f) => f.rule === "agent-autonomy") ? ["Agents ask before they act"] : []),
  ];

  return (
    <Card title="Ready to ship" icon={<Rocket className="size-3.5 text-brand" />}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Security check</span>
        <button onClick={() => { setFindings(null); void rescan(); }} className="underline-offset-2 hover:underline">Re-scan</button>
      </div>
      {!findings ? <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Scanning code, keys, connections and agents…</p> : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {findings.map((f) => (
            <li key={f.id} className={cn("rounded-lg border p-2", f.severity === "high" ? "border-destructive/30 bg-destructive/5" : f.severity === "medium" ? "border-warning/40 bg-warning-soft/50" : "bg-muted/40")}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", f.severity === "high" ? "text-destructive" : "text-warning")} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.detail}</div>
                  {mode === "developer" && f.file && <div className="mt-1 truncate font-mono text-[11px] text-dev">{f.file}:{f.line} · {f.rule}{f.excerpt ? ` · ${f.excerpt}` : ""}</div>}
                  {f.fix && <Button size="xs" className="mt-2" variant={f.severity === "high" ? "default" : "outline"} disabled={!!fixing} onClick={() => fix(f)}>
                    {fixing === f.id && <Loader2 className="animate-spin" />}{f.fix === "vault" ? "Move to vault" : f.fix === "connect" ? "Connect" : "Add approval"}
                  </Button>}
                </div>
              </div>
            </li>
          ))}
          {passed.map((p) => <li key={p} className="flex items-start gap-2 px-2"><Check className="mt-0.5 size-3.5 text-success" /><span className="flex-1">{p}</span></li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center rounded-lg border bg-background px-2 text-xs"><span className="text-muted-foreground">https://</span><input defaultValue={project.slug} className="min-w-0 flex-1 bg-transparent py-1.5 font-mono outline-none" aria-label="Subdomain" /><span className="text-muted-foreground">.architect.app</span></div>
      <button className="mt-1 text-[11px] text-muted-foreground underline underline-offset-2" onClick={() => toast("Custom domains: add a CNAME to cname.architect.app, we handle SSL.")}>Use my own domain</button>
      {project.demo_data && <p className="mt-2 rounded-md bg-warning-soft p-2 text-[11px]">Heads up: visitors will see sample data until you connect real accounts.</p>}
      {blocked && (
        <p className="mt-2 rounded-md bg-destructive/10 p-2 text-[11px]">Fix the {high.length === 1 ? "issue" : `${high.length} issues`} in red before going public — or{" "}
          <button className="font-medium underline underline-offset-2" onClick={() => { if (confirm("Ship with a secret exposed in the code? Anyone who can read it could use it.")) setOverride(true); }}>ship anyway</button>.</p>
      )}
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        {/* Preview = open the app as it is now, privately, in a new tab — no deployment */}
        <Button variant="outline" asChild title="Open your app in a new tab — private to you and your team, nothing is deployed">
          <a href={`/preview/${project.id}`} target="_blank" rel="noreferrer"><Eye /> Preview</a>
        </Button>
        <Button disabled={phase >= 0 || !findings || blocked} onClick={deploy}>
          {phase >= 0 ? <><Loader2 className="animate-spin" /> {PHASES[phase]}…</> : <><Rocket /> Deploy to production</>}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Preview is private to you and your team. Production gives everyone a public URL.</p>
    </Card>
  );
}

/* ---------------- Live ---------------- */

export function LiveCard({ project, later, onAddBack, author }: { project: Project; later: string[]; onAddBack: (s: string) => void; author: string }) {
  const url = `${useOrigin()}/live/${project.slug}`;
  const [inGallery, setInGallery] = useState(!!project.showcase);
  const [shownAs, setShownAs] = useState(project.showcase_author ?? author);
  const saveGallery = async (on: boolean, name = shownAs) => {
    setInGallery(on);
    const r = await setShowcase(project.id, on, name).catch(() => ({ error: "Couldn't update the gallery." }));
    if ("error" in r) { toast.error(r.error); setInGallery(!on); } else if (on) toast.success("Listed in the community gallery — others can try and remix it");
  };
  return (
    <Card title="Live" icon={<span className="size-2 rounded-full bg-success" />}>
      <div className="flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
        <span className="flex-1 truncate font-mono">{url}</span>
        <Button size="icon-xs" variant="ghost" aria-label="Copy link" onClick={() => { navigator.clipboard.writeText(url); toast("Link copied"); }}><Copy /></Button>
        <Button size="icon-xs" variant="ghost" asChild aria-label="Open live app"><a href={`/live/${project.slug}`} target="_blank"><ExternalLink /></a></Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">{project.views ?? 0}</div>views</div>
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">{project.remixes ?? 0}</div>remixes</div>
        <div className="rounded-lg bg-muted p-2"><div className="text-base font-semibold">${projectSpend(project).toFixed(2)}</div>total spent</div>
      </div>
      <div className="mt-3 rounded-lg border p-2.5">
        <label className="flex items-center justify-between gap-3 text-sm"><span><span className="block font-medium">Show in community gallery</span><span className="text-xs text-muted-foreground">Others can try it and remix a copy. Your data and accounts are never shared.</span></span>
          <Switch checked={inGallery} onCheckedChange={(v) => saveGallery(v)} aria-label="Show in community gallery" /></label>
        {inGallery && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">Show my name as
            <Input value={shownAs} onChange={(e) => setShownAs(e.target.value)} onBlur={() => saveGallery(true)} placeholder="Leave empty to stay anonymous" className="h-7 flex-1 text-xs" /></label>
        )}
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
