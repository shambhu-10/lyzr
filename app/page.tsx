import Link from "next/link";
import { ArrowRight, Check, Code2, GitBranch, GitFork, Palette, ShieldCheck, Sparkles, Type, Users, Wallet, Wand2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HeroPrompt } from "@/components/landing/hero-prompt";
import { LiveDemo } from "@/components/landing/live-demo";
import { ShowcaseCard } from "@/components/community/showcase-card";
import { getShowcase } from "@/lib/showcase";
import { LogoStrip } from "@/components/landing/logo-strip";
import { HeroTitle } from "@/components/landing/hero-title";
import { ThemeToggle } from "@/components/theme-toggle";

export const revalidate = 60; // gallery counts refresh at most once a minute; the page stays static

const REPO = "https://github.com/shambhu-10/lyzr";

const STEPS = [
  { n: "01", t: "Plan", d: "Architect asks the right questions, then writes a plan you can read — with what's in, what's later, and what it will cost." },
  { n: "02", t: "Connect", d: "Link Google, Slack or your API keys before anything is built, so your app works on real data — not samples." },
  { n: "03", t: "Build", d: "Watch your screens come together live. Developers can open the code, diffs and terminal at any moment." },
  { n: "04", t: "Test", d: "Every build is checked in plain language. Talk to your agents in a playground before anyone else does." },
  { n: "05", t: "Ship", d: "A real security check catches exposed keys and gaps, fixes them in one click, then gives you a live URL." },
];

const FRAMEWORKS = ["Lyzr", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Google ADK", "Mastra"];

export default async function Landing() {
  const apps = await getShowcase(6);

  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#lenses" className="hover:text-foreground">Builders &amp; developers</a>
            {apps.length > 0 && <a href="#showcase" className="hover:text-foreground">Showcase</a>}
            <a href="#features" className="hover:text-foreground">What&apos;s new</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
            <Button asChild><Link href="/login">Start building</Link></Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 py-16 text-center">
        <div className="mesh pointer-events-none absolute inset-0 -z-10" />
        <div className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] opacity-60" />
        <HeroTitle />
        <p className="rise-2 mx-auto mt-5 text-base tracking-tight text-foreground/80 md:text-lg">
          Describe it. Build it. <span className="font-display text-[1.12em] text-brand italic">Own it.</span>
        </p>
        <p className="rise-2 mx-auto mt-1.5 text-xs text-muted-foreground md:text-sm">
          The agent builder for builders <span className="font-display text-[1.08em] italic">and</span> developers
        </p>
        <div className="rise-3 mt-8 w-full"><HeroPrompt /></div>
        <div className="rise-4 mt-6 w-full"><LogoStrip /></div>
      </section>


      <section className="px-5 py-24">
        <div className="reveal mx-auto max-w-5xl">
          <p className="mb-4 text-center text-sm text-muted-foreground">This is the real app renderer — click a meeting, then flip to Developer to see the generated code.</p>
          <LiveDemo />
        </div>
      </section>

      {apps.length > 0 && (
        <section id="showcase" className="scroll-mt-16 border-y bg-card/50 px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs font-medium tracking-wide text-brand uppercase">Built on Architect</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Real apps, shipped by real people.</h2>
                <p className="mt-3 text-muted-foreground">Every card is a live app its maker chose to share — with real view and remix counts. Try one, or remix a copy and make it yours.</p>
              </div>
              <Button variant="outline" asChild><Link href="/explore?tab=community">See the whole gallery <ArrowRight /></Link></Button>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((a) => <div key={a.slug} className="reveal"><ShowcaseCard app={a} /></div>)}
            </div>
          </div>
        </section>
      )}

      <section id="lenses" className="scroll-mt-16 px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">One project. Two ways to see it.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Flip one switch in any project. Nothing is lost, nothing is duplicated — it&apos;s the same app, shown the way you think.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <LensCard
              icon={<Wand2 className="size-4" />} title="Builder view" who="For business teams, founders, consultants"
              points={["Plain-language plan and progress", "Pick a look, edit text right in the app", "Visual agent map with guardrails", "One-click connect and ship"]}
            >
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-success" /> Planned 3 screens</div>
                <div className="flex items-center gap-2 text-xs"><Check className="size-3.5 text-success" /> Connected Google Calendar</div>
                <div className="flex items-center gap-2 text-xs"><span className="size-3.5 animate-pulse rounded-full bg-brand/60" /> Building “Meeting context”…</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="h-16 rounded-md bg-brand-soft" /><div className="h-16 rounded-md shimmer" /><div className="h-16 rounded-md bg-spark-soft" />
                </div>
              </div>
            </LensCard>
            <LensCard
              dev icon={<Code2 className="size-4" />} title="Developer view" who="For engineers who want control"
              points={["Editor with AI autocomplete, ⌘K edits, diffs", "Agents in LangGraph, CrewAI, OpenAI SDK…", "Encrypted env vars, logs, evals", "AGENTS.md, zip export, Open in Cursor"]}
            >
              <pre className="overflow-hidden p-4 font-mono text-[11px] leading-5">
                <span className="text-muted-foreground">app/page.tsx</span>{"\n"}
                <span className="text-destructive">- const key = &quot;gsk_••••3f9a&quot;</span>{"\n"}
                <span className="text-success">+ const key = process.env.GROQ_API_KEY</span>{"\n"}
                <span className="text-muted-foreground">✓ security check passed · moved 1 secret to vault</span>
              </pre>
            </LensCard>
          </div>
          <div className="reveal mt-8 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-muted-foreground">Agents in any framework — build new or import yours:</span>
            {FRAMEWORKS.map((f) => <span key={f} className="rounded-full border bg-card px-3 py-1">{f}</span>)}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-16 border-y bg-card/50 px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Five clear steps. Always know where you are.</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-5 md:gap-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className="reveal relative">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-brand bg-background font-mono text-xs font-semibold text-brand">{s.n}</span>
                  {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-gradient-to-r from-brand/60 to-border md:block" />}
                </div>
                <div className="mt-4 font-semibold">{s.t}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-16 px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">Everything you need to go from idea to live — and trust it.</h2>
          <div className="mt-12 grid auto-rows-[minmax(170px,auto)] gap-4 md:grid-cols-6">
            <Bento className="md:col-span-4" tone="brand" icon={<Palette />} title="Pick a look" d="Three AI-designed directions, rendered as real previews of your app. Switch colours, corners and fonts anytime — even after it's live.">
              <div className="mt-5 flex gap-2">{["#139C8E", "#4F5BD5", "#E0654A", "#7C4DDB", "#C98410"].map((c) => <span key={c} className="h-9 flex-1 rounded-lg shadow-[var(--shadow-soft)]" style={{ background: c }} />)}</div>
            </Bento>
            <Bento className="md:col-span-2" icon={<Type />} title="Edit text in place" d="Click any label in your app and type. Instant, free, and every edit is a version you can undo." />
            <Bento className="md:col-span-2" icon={<ShieldCheck />} title="Security check that fixes things" d="Finds keys written in code, missing settings and agents that act without asking — then fixes them in one click." />
            <Bento className="md:col-span-2" icon={<GitFork />} title="Remix anything" d="Every shared app has a Remix button. Get the plan, screens and agents — connect your own accounts." />
            <Bento className="md:col-span-2" icon={<Users />} title="Build as a team" d="Invite teammates to edit or view with a link. Everyone works on the same project." />
            <Bento className="md:col-span-3" tone="spark" icon={<Wallet />} title="Know the cost first" d="Every build shows an estimate before you commit and what it actually cost after. Our mistakes are free — the AI stops after 3 tries and asks you." />
            <Bento className="md:col-span-3" tone="dev" icon={<GitBranch />} title="You own the code" d="Standard Next.js code, AGENTS.md, zip export and Open in Cursor. No lock-in, ever." />
          </div>

          <div className="relative mt-20 overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground">
            <div className="mesh pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex flex-col items-center gap-4">
              <Sparkles className="size-6 text-spark" />
              <h3 className="text-3xl font-semibold tracking-tight md:text-4xl">What will you build first?</h3>
              <p className="max-w-md text-primary-foreground/70">Start from a sentence, a template, or someone else&apos;s app.</p>
              <Button size="lg" variant="secondary" asChild><Link href="/login">Start building free <ArrowRight /></Link></Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t px-5 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span>Architect 2.0 · a product concept by Shambhu Kumar</span>
          <span className="flex gap-5"><a href={REPO} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a><a href={`${REPO}#readme`} target="_blank" rel="noreferrer" className="hover:text-foreground">How it&apos;s built</a><Link href="/login" className="hover:text-foreground">Sign in</Link></span>
        </div>
      </footer>
    </div>
  );
}

function Bento({ icon, title, d, className, tone, children }: { icon: React.ReactNode; title: string; d: string; className?: string; tone?: "brand" | "spark" | "dev"; children?: React.ReactNode }) {
  const t = tone === "brand" ? "bg-brand-soft/60 [&_.ic]:bg-brand [&_.ic]:text-brand-foreground" : tone === "spark" ? "bg-spark-soft/60 [&_.ic]:bg-spark [&_.ic]:text-white" : tone === "dev" ? "bg-dev-soft/60 [&_.ic]:bg-dev [&_.ic]:text-white" : "bg-card [&_.ic]:bg-muted [&_.ic]:text-foreground";
  return (
    <div className={`reveal flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${t} ${className ?? ""}`}>
      <span className="ic grid size-9 place-items-center rounded-lg [&_svg]:size-4">{icon}</span>
      <div className="mt-4 font-semibold">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
      {children}
    </div>
  );
}

function LensCard({ icon, title, who, points, children, dev }: { icon: React.ReactNode; title: string; who: string; points: string[]; children: React.ReactNode; dev?: boolean }) {
  return (
    <div className="reveal overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-soft)]">
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
