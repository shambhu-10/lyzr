"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Code2, Wand2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, roleById } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "./actions";

export function Onboarding({ defaultName }: { defaultName: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [org, setOrg] = useState("");
  const [role, setRole] = useState<string>("");
  const [mode, setMode] = useState<"builder" | "developer" | "">("");
  const canNext = [name.trim().length > 0, !!role, !!mode][step];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo href="#" />
        <span className="text-sm text-muted-foreground">Step {step + 1} of 3</span>
      </header>
      <div className="mx-auto h-1 w-full max-w-xl overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-brand transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>
      <form action={completeOnboarding} className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <input type="hidden" name="full_name" value={name} />
        <input type="hidden" name="org_name" value={org} />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="mode" value={mode} />

        {step === 0 && (
          <div className="rise space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s set up your workspace</h1>
              <p className="mt-2 text-muted-foreground">This takes about 20 seconds.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="n">Your name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="o">Company or team <span className="text-muted-foreground">(optional)</span></Label><Input id="o" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Acme Inc." className="h-11" /></div>
          </div>
        )}

        {step === 1 && (
          <div className="rise space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">What do you do?</h1>
              <p className="mt-2 text-muted-foreground">We&apos;ll suggest things people like you build first.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((r) => (
                <button type="button" key={r.id} onClick={() => setRole(r.id)}
                  className={cn("rounded-xl border bg-card p-4 text-left transition hover:border-foreground/25", role === r.id && "border-brand ring-3 ring-brand/15")}>
                  <div className="flex items-center justify-between font-medium">{r.label}{role === r.id && <Check className="size-4 text-brand" />}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{r.hint}</div>
                </button>
              ))}
            </div>
            {role && (
              <div className="rise rounded-xl border border-dashed p-4 text-sm">
                <div className="text-muted-foreground">Popular with {roleById(role).label}:</div>
                <ul className="mt-2 space-y-1">{roleById(role).ideas.map((i) => <li key={i}>• {i}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rise space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">How do you like to work?</h1>
              <p className="mt-2 text-muted-foreground">This is just your starting view. You can switch in any project, any time.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ModeCard active={mode === "builder"} onClick={() => setMode("builder")} icon={<Wand2 className="size-4" />} title="Builder" line="I describe it, Architect builds it."
                bullets={["Plain-language plans & progress", "Visual agents, no code", "Recommended for most people"]} />
              <ModeCard dev active={mode === "developer"} onClick={() => setMode("developer")} icon={<Code2 className="size-4" />} title="Developer" line="Show me the code and let me drive."
                bullets={["Files, editor, diffs, terminal", "Pick agent framework & model", "GitHub branches and PRs"]} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-12">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} className={cn(step === 0 && "invisible")}><ArrowLeft /> Back</Button>
          {step < 2 ? (
            <Button type="button" size="lg" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight /></Button>
          ) : (
            <Button type="submit" size="lg" disabled={!canNext}>Enter Architect <ArrowRight /></Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, line, bullets, dev }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; line: string; bullets: string[]; dev?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-2xl border bg-card p-5 text-left transition hover:border-foreground/25", active && (dev ? "border-dev ring-3 ring-dev/15" : "border-brand ring-3 ring-brand/15"))}>
      <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium", dev ? "bg-dev-soft text-dev" : "bg-brand-soft text-brand")}>{icon}{title}</span>
      <p className="mt-4 font-medium">{line}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">{bullets.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0" />{b}</li>)}</ul>
    </button>
  );
}
