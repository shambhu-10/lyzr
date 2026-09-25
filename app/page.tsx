import Link from "next/link";
import { ArrowRight, Check, Code2, GitBranch, Plug, ShieldCheck, Sparkles, Wallet, Wand2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HeroPrompt } from "@/components/landing/hero-prompt";
import { LiveDemo } from "@/components/landing/live-demo";

const STEPS = [
  { n: "01", t: "Plan", d: "Architect asks the right questions, then writes a plan you can read — with what's in, what's later, and what it will cost." },
  { n: "02", t: "Connect", d: "Link Google, Slack or your API keys before anything is built, so your app works on real data — not samples." },
  { n: "03", t: "Build", d: "Watch your screens come together live. Developers can open the code, diffs and terminal at any moment." },
  { n: "04", t: "Test", d: "Every build is checked in plain language. Talk to your agents in a playground before anyone else does." },
  { n: "05", t: "Ship", d: "A pre-flight check catches missing keys and security gaps, then one click gives you a live URL." },
];

const FRAMEWORKS = ["Lyzr", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Google ADK", "Mastra"];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#lenses" className="hover:text-foreground">Builders &amp; developers</a>
            <a href="#agents" className="hover:text-foreground">Agents</a>
            <a href="#trust" className="hover:text-foreground">Why Architect</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
            <Button asChild><Link href="/login">Start building</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 pt-20 pb-24 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--brand-soft),transparent)]" />
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-brand" /> Architect 2.0 — now for builders <em>and</em> developers
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight md:text-7xl">
          Describe it. Build it. <span className="font-display font-normal whitespace-nowrap italic text-brand">Own it.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Turn an idea into a working agentic app — planned with you, connected to your real tools, and shipped to a live URL. Switch to the code whenever you want.
        </p>
        <div className="mt-10"><HeroPrompt /></div>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-center text-sm text-muted-foreground">This is the real app renderer — click a meeting, then flip to Developer to see the generated code.</p>
          <LiveDemo />
        </div>
      </section>

      <section id="lenses" className="border-y bg-card/50 px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">One project. Two ways to see it.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Flip one switch in any project. Nothing is lost, nothing is duplicated — it&apos;s the same app, shown the way you think.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <LensCard
              icon={<Wand2 className="size-4" />} title="Builder view" who="For business teams, founders, consultants"
              points={["Plain-language plan and progress", "See each screen appear as it's built", "Visual agent map with guardrails", "One-click connect and ship"]}
            >
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-success" /> Planned 3 screens</div>
                <div className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-success" /> Connected Google Calendar</div>
                <div className="flex items-center gap-2 text-xs"><span className="size-3.5 animate-pulse rounded-full bg-brand/60" /> Building “Meeting context”…</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="h-16 rounded-md bg-brand-soft" /><div className="h-16 rounded-md shimmer" /><div className="h-16 rounded-md bg-muted" />
                </div>
              </div>
            </LensCard>
            <LensCard
              dev icon={<Code2 className="size-4" />} title="Developer view" who="For engineers who want control"
              points={["File tree, editor, live diffs, terminal", "Agents in LangGraph, CrewAI, OpenAI SDK…", "Traces, evals, env vars, branches", "Two-way GitHub sync and PRs"]}
            >
              <pre className="overflow-hidden p-4 font-mono text-[11px] leading-5">
                <span className="text-muted-foreground">app/page.tsx</span>{"\n"}
                <span className="text-destructive">- activeAgentId</span>{"\n"}
                <span className="text-success">+ runningAgentId</span>{"\n"}
                <span className="text-muted-foreground">$ next build  ✓ 0 errors · GET / 200</span>
              </pre>
            </LensCard>
          </div>
        </div>
      </section>

      <section id="how" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Five clear steps. Always know where you are.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-card p-6">
                <div className="font-mono text-xs text-brand">{s.n}</div>
                <div className="mt-3 font-semibold">{s.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="agents" className="border-y bg-card/50 px-5 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Agents in any framework.</h2>
            <p className="mt-3 text-muted-foreground">Build new agents or import the ones you already have. Configure, test, trace and evaluate them right next to your app — no jumping between tools.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => <span key={f} className="rounded-full border bg-background px-3 py-1 text-sm">{f}</span>)}
            </div>
          </div>
          <div className="rounded-2xl border bg-background p-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Briefly · agents</span><span>3 nodes</span></div>
            <div className="mt-6 flex items-center justify-between gap-2 text-xs">
              {["Calendar event", "Meeting Brief Agent", "Briefing note"].map((n, i) => (
                <div key={n} className="flex flex-1 items-center gap-2">
                  <div className={`flex-1 rounded-lg border px-3 py-3 text-center ${i === 1 ? "border-brand bg-brand-soft font-medium" : "bg-card"}`}>{n}</div>
                  {i < 2 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="trust" className="px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Built to be trusted.</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: <Wallet className="size-5" />, t: "Know the cost first", d: "Every build shows an estimate before you commit, and a receipt after." },
              { i: <Sparkles className="size-5" />, t: "Our mistakes are free", d: "When the AI fixes its own error, you don't pay. It stops after 3 tries and asks you." },
              { i: <ShieldCheck className="size-5" />, t: "Secure by default", d: "Row-level security and a plain-language security check before anything goes live." },
              { i: <GitBranch className="size-5" />, t: "You own the code", d: "Standard code, two-way GitHub sync, export anytime. No lock-in." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border bg-card p-6">
                <div className="text-brand">{c.i}</div>
                <div className="mt-4 font-semibold">{c.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
            <Plug className="size-6 opacity-70" />
            <h3 className="text-3xl font-semibold tracking-tight">What will you build first?</h3>
            <Button size="lg" variant="secondary" asChild><Link href="/login">Start building free <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span>Architect 2.0 · a product concept by Shambhu Kumar</span>
          <span className="flex gap-5"><a href="#">Privacy</a><a href="#">Security</a><a href="#">Terms</a></span>
        </div>
      </footer>
    </div>
  );
}

function LensCard({ icon, title, who, points, children, dev }: { icon: React.ReactNode; title: string; who: string; points: string[]; children: React.ReactNode; dev?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="p-6">
        <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${dev ? "bg-dev-soft text-dev" : "bg-brand-soft text-brand"}`}>{icon}{title}</div>
        <p className="mt-3 text-sm text-muted-foreground">{who}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{p}</li>)}
        </ul>
      </div>
      <div className={`border-t ${dev ? "bg-[oklch(0.18_0.01_260)] text-[oklch(0.9_0_0)]" : "bg-card"}`}>{children}</div>
    </div>
  );
}
