"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Code2, Database, Eye, FileText, History, MessageSquare, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceHeader } from "./header";
import { Chat } from "./chat";
import { PlanPanel } from "./plan-panel";
import { CodePanel } from "./code-panel";
import { BuildCard, ConnectCard, LiveCard, ShipCard, TestCard } from "./stage-cards";
import { AppPreview } from "@/components/app-preview/app-preview";
import { AgentCanvas } from "@/components/agents/agent-canvas";
import { AgentDrawer } from "@/components/agents/agent-drawer";
import { Button } from "@/components/ui/button";
import { askQuestions, deploy, finishBuild, quickChange, revertTo, revisePlan, saveFile, setConnection, setStage, submitAnswers, type Msg } from "@/lib/actions/workspace";
import { buildSteps, testChecks } from "@/lib/script/build";
import { filesFor } from "@/lib/script/files";
import { projectSpend } from "@/lib/usage";
import type { AgentRow, FileRow, VersionRow } from "@/lib/workspace-types";
import type { Mode, Plan, Project, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "plan" | "preview" | "agents" | "code" | "data" | "versions";
const ORDER: Stage[] = ["plan", "connect", "build", "test", "ship", "live"];
const SPEED = 1; // step durations are already compressed for the prototype

export function Workspace({ initial, defaultMode, otherSpend }: {
  initial: { project: Project; messages: Msg[]; files: FileRow[]; agents: AgentRow[]; versions: VersionRow[] };
  defaultMode: Mode;
  otherSpend: number;
}) {
  const [project, setProject] = useState(initial.project);
  const [messages, setMessages] = useState(initial.messages);
  const [files, setFiles] = useState(initial.files);
  const [agents, setAgents] = useState(initial.agents);
  const [versions, setVersions] = useState(initial.versions);
  const [mode, setModeState] = useState<Mode>(defaultMode);
  const [view, setView] = useState<Stage>(project.stage === "live" ? "ship" : project.stage);
  const [tab, setTab] = useState<Tab>(project.stage === "plan" || project.stage === "connect" ? "plan" : "preview");
  const [busy, setBusy] = useState<string | null>(null);
  const [planFirst, setPlanFirst] = useState(false);
  const [drawer, setDrawer] = useState<AgentRow | null>(null);
  const [mobilePane, setMobilePane] = useState<"chat" | "app">("chat");
  const plan = project.plan;
  const framework = (project.source as { framework?: string } | null)?.framework ?? "lyzr";
  const reached = ORDER.indexOf(project.stage);

  useEffect(() => {
    let m: string | null = null;
    try { m = localStorage.getItem(`architect:mode:${project.id}`); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore per-project view preference from localStorage after hydration
    if (m === "builder" || m === "developer") setModeState(m);
  }, [project.id]);
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(`architect:mode:${project.id}`, m); } catch {}
    if (m === "builder" && tab === "code") setTab("preview");
    if (m === "developer" && project.stage === "build") setTab("code");
    toast(m === "developer" ? "Developer view — code, diffs and terminal are open" : "Builder view — technical details hidden", { duration: 1800 });
  };

  const patch = (p: Partial<Project>) => setProject((x) => ({ ...x, ...p }));
  const goStage = async (s: Stage) => { patch({ stage: s }); setView(s === "live" ? "ship" : s); await setStage(project.id, s); };
  const push = (m: Msg[]) => setMessages((x) => [...x, ...m]);

  /* ---- Plan: ask clarifying questions once ---- */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || project.stage !== "plan" || messages.some((m) => m.kind === "questions")) return;
    asked.current = true;
    setBusy("Reading your idea…");
    askQuestions(project.id).then((m) => { if (m) push([m]); }).finally(() => setBusy(null));
  }, [project.id, project.stage, messages]);

  const onAnswer = async (summary: string) => {
    setBusy("Writing your plan — usually 20–40 seconds…");
    setTab("plan");
    try { const r = await submitAnswers(project.id, summary); patch({ plan: r.plan, name: r.plan.name, slug: r.slug }); push(r.messages); }
    catch { toast.error("Couldn't write the plan. Please try again."); }
    setBusy(null);
  };

  const revise = async (instruction: string) => {
    setBusy("Updating the plan…"); setTab("plan");
    try { const r = await revisePlan(project.id, instruction); patch({ plan: r.plan, name: r.plan.name }); push(r.messages); }
    catch { toast.error("Couldn't update the plan."); }
    setBusy(null);
  };

  const onSend = async (text: string) => {
    if (!plan) return toast("Answer the questions above first, or pick the recommended options.");
    if (project.stage === "plan" || project.stage === "connect" || planFirst) return revise(text);
    setBusy("Making the change…");
    const r = await quickChange(project.id, text);
    push(r.messages);
    if (r.version) setVersions((v) => [r.version as VersionRow, ...v]);
    setBusy(null);
  };

  /* ---- Connect ---- */
  const onSetConnection = async (id: string, s: "connected" | "sample") => { const r = await setConnection(project.id, id, s); patch(r); };

  /* ---- Build (scripted timeline) ---- */
  const steps = useMemo(() => (plan ? buildSteps(plan, framework) : []), [plan, framework]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [terminal, setTerminal] = useState<string[]>([]);
  const finishing = useRef(false);
  const building = project.stage === "build";

  useEffect(() => {
    if (!building || paused || !steps.length) return;
    if (at >= steps.length) {
      if (finishing.current) return;
      finishing.current = true;
      finishBuild(project.id).then((r) => {
        setFiles(r.files);
        setAgents(r.agents);
        push([r.message]);
        setVersions((v) => [{ id: crypto.randomUUID(), label: "First build", created_at: new Date().toISOString() }, ...v]);
        patch({ stage: "test" }); setView("test");
        toast.success("Build finished — testing now");
      });
      return;
    }
    const s = steps[at];
    const t = setTimeout(() => { setTerminal((x) => [...x, ...(s.terminal ?? [])]); setAt((a) => a + 1); }, s.ms / SPEED);
    return () => clearTimeout(t);
  }, [building, paused, at, steps, project.id]);

  const startBuild = async () => {
    setAt(0); setTerminal([]); finishing.current = false;
    setTab(mode === "developer" ? "code" : "preview");
    setMobilePane("chat");
    await goStage("build");
  };

  const revealed = !plan ? 0 : building ? steps.slice(0, at).filter((s) => s.reveal !== undefined).length : reached >= ORDER.indexOf("test") ? plan.screens.length : 0;
  const liveFiles: FileRow[] = useMemo(() => {
    if (!building || !plan) return files;
    const done = new Set(steps.slice(0, at + 1).map((s) => s.file).filter(Boolean));
    const gen = filesFor(plan, framework);
    return gen.filter((f, i) => (at > 0 && ["AGENTS.md", "app/layout.tsx", "lib/agents.ts", ".env.example"].includes(f.path)) || done.has(f.path) || (i === 0 && at > 0));
  }, [building, plan, steps, at, files, framework]);
  const writing = building ? steps[at]?.file : undefined;
  const remaining = Math.round(steps.slice(at).reduce((a, s) => a + s.ms, 0) / 1000 / SPEED);

  /* ---- Ship ---- */
  const onDeploy = async (t: "preview" | "production") => {
    const msg = await deploy(project.id, t);
    const label = t === "production" ? "Published to production" : "Preview deployment";
    setVersions((v) => [{ id: crypto.randomUUID(), label, created_at: new Date().toISOString() }, ...v]);
    if (t === "production") { patch({ stage: "live" }); toast.success("You're live!"); }
    else toast.success("Preview deployed");
    push([msg]);
  };

  const openAgent = useCallback((name: string) => {
    const a = agents.find((x) => x.name === name);
    if (a) setDrawer(a); else toast("This agent will be created when you build.");
  }, [agents]);

  const placeholder = !plan ? "Or describe anything else you want…" : project.stage === "plan" ? "Ask for changes to the plan…" : planFirst ? "Describe a change — I'll update the plan first…" : "Ask for a change, e.g. “make the brief shorter”…";
  const credits = Math.max(0, 20 - otherSpend - projectSpend(project));
  const later = plan?.scope.filter((s) => s.status === "later").map((s) => s.item) ?? [];

  const stageCard = () => {
    if (!plan) return null;
    const v = ORDER.indexOf(view);
    if (v > reached) return null;
    if (view === "connect") return <ConnectCard plan={plan} project={project} onSet={onSetConnection} onStart={startBuild} />;
    if (view === "build") return building ? <BuildCard steps={steps} at={at} mode={mode} paused={paused} onPause={() => setPaused((p) => !p)} remaining={remaining} /> : <BuildCard steps={steps} at={steps.length} mode={mode} paused={false} onPause={() => {}} remaining={0} />;
    if (view === "test") return <TestCard checks={testChecks(plan, project.demo_data)} mode={mode} onFix={() => setView("connect")} onPlayground={() => { setTab("agents"); if (agents[0]) setDrawer(agents[0]); }} onContinue={() => goStage("ship")} />;
    if (view === "ship") return project.stage === "live" ? <LiveCard project={project} later={later} onAddBack={(s) => revise(`Add back: ${s}`)} /> : <ShipCard project={project} onDeploy={onDeploy} onFixConnections={() => setView("connect")} />;
    return null;
  };

  const TABS: { id: Tab; label: string; icon: typeof Eye; dev?: boolean }[] = [
    { id: "plan", label: "Plan", icon: FileText },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "code", label: "Code", icon: Code2, dev: true },
    { id: "data", label: "Data", icon: Database },
    { id: "versions", label: "Versions", icon: History },
  ];

  return (
    <div className="flex h-screen flex-col">
      <WorkspaceHeader project={project} mode={mode} onMode={setMode} view={view} onView={setView} credits={credits} />
      <div className="flex border-b md:hidden">
        {(["chat", "app"] as const).map((p) => (
          <button key={p} onClick={() => setMobilePane(p)} className={cn("flex flex-1 items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground", mobilePane === p && "border-b-2 border-foreground font-medium text-foreground")}>
            {p === "chat" ? <MessageSquare className="size-4" /> : <Eye className="size-4" />}{p === "chat" ? "Chat" : "App"}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <section className={cn("min-h-0 w-full flex-col border-r md:flex md:w-[400px] md:shrink-0 lg:w-[420px]", mobilePane === "chat" ? "flex" : "hidden")} aria-label="Chat with Architect">
          <Chat messages={messages} busy={!!busy} busyLabel={busy ?? ""} placeholder={placeholder} onSend={onSend} onAnswer={onAnswer} planToggle={planFirst} onPlanToggle={setPlanFirst}>
            {stageCard()}
          </Chat>
        </section>
        <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", mobilePane === "app" ? "flex" : "hidden")} aria-label="Your app">
          <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
            {TABS.filter((t) => !t.dev || mode === "developer").map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground", tab === t.id && "bg-muted font-medium text-foreground", t.dev && "text-dev")}>
                <t.icon className="size-3.5" />{t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
            {tab === "plan" && <PlanPanel plan={plan} mode={mode} framework={framework} busy={!!busy} canApprove={project.stage === "plan"} onApprove={() => { goStage("connect"); toast.success("Plan approved"); }} onAddBack={(item) => revise(`Add back: ${item}`)} />}
            {tab === "preview" && (plan ? <div className="h-full p-4">{revealed || building ? <AppPreview plan={plan} revealed={revealed} demo={project.demo_data} building={building} /> : <EmptyPreview stage={project.stage} />}</div> : <EmptyPreview stage="plan" />)}
            {tab === "agents" && (plan ? <AgentCanvas plan={plan} framework={framework} built={agents.length > 0} onOpen={openAgent} /> : <EmptyPreview stage="plan" />)}
            {tab === "code" && <CodePanel files={liveFiles} locked={building && !paused} terminal={terminal} writing={writing} onSave={(p, c) => { setFiles((fs) => fs.map((f) => (f.path === p ? { ...f, content: c } : f))); return saveFile(project.id, p, c); }} />}
            {tab === "data" && <DataPanel plan={plan} demo={project.demo_data} mode={mode} />}
            {tab === "versions" && <VersionsPanel versions={versions} mode={mode} onRevert={async (v) => { const f = await revertTo(project.id, v.id); setFiles(f); setVersions((x) => [{ id: crypto.randomUUID(), label: `Restored “${v.label}”`, created_at: new Date().toISOString() }, ...x]); toast.success(`Restored “${v.label}”`); }} />}
          </div>
        </section>
      </div>
      <AgentDrawer agent={drawer} mode={mode} open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)} onChange={(a) => setAgents((xs) => xs.map((x) => (x.id === a.id ? a : x)))} />
    </div>
  );
}

function EmptyPreview({ stage }: { stage: Stage }) {
  const msg = stage === "plan" ? "Your app appears here once the plan is approved and built." : stage === "connect" ? "Connect your accounts, then start the build to watch your app come together here." : "Nothing to preview yet.";
  return <div className="grid h-full min-h-80 place-items-center p-10 text-center text-sm text-muted-foreground"><div className="max-w-xs"><Eye className="mx-auto mb-3 size-6" />{msg}</div></div>;
}

function DataPanel({ plan, demo, mode }: { plan: Plan | null; demo: boolean; mode: Mode }) {
  if (!plan?.data.length)
    return <div className="grid h-full min-h-80 place-items-center p-10 text-center text-sm text-muted-foreground"><div className="max-w-xs"><Database className="mx-auto mb-3 size-6" />This app doesn&apos;t store anything — every run is fresh and private. Ask Architect to “save history” to add a database.</div></div>;
  return (
    <div className="space-y-4 p-6">
      {demo && <div className="rounded-lg bg-warning-soft p-3 text-xs">Showing sample rows. Real data appears once the app is live on connected accounts.</div>}
      {plan.data.map((d) => (
        <div key={d} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">{d}<span className="text-xs font-normal text-muted-foreground">{mode === "developer" ? "RLS: owner only · 3 rows" : "Private to each user · 3 records"}</span></div>
          <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="px-4 py-2 font-normal">id</th><th className="font-normal">summary</th><th className="font-normal">created</th></tr></thead>
            <tbody>{[1, 2, 3].map((i) => <tr key={i} className="border-t"><td className="px-4 py-2 font-mono">{i}</td><td>Sample {d.toLowerCase()} #{i}</td><td>{i}h ago</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}

function VersionsPanel({ versions, mode, onRevert }: { versions: VersionRow[]; mode: Mode; onRevert: (v: VersionRow) => void }) {
  if (!versions.length) return <div className="grid h-full min-h-80 place-items-center text-sm text-muted-foreground">Every build and change is saved here as a version you can restore.</div>;
  return (
    <ol className="mx-auto max-w-2xl space-y-2 p-6">
      {versions.map((v, i) => (
        <li key={v.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <span className={cn("size-2 rounded-full", i === 0 ? "bg-brand" : "bg-border")} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{v.label}</div>
            <div className="text-xs text-muted-foreground" suppressHydrationWarning>{new Date(v.created_at).toLocaleString()}{mode === "developer" && <> · <span className="font-mono">{v.id.slice(0, 7)}</span></>}</div>
          </div>
          {i === 0 ? <span className="text-xs text-muted-foreground">Current</span> : <Button size="xs" variant="outline" onClick={() => onRevert(v)}><RotateCcw /> Restore</Button>}
        </li>
      ))}
    </ol>
  );
}
