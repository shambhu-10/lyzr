"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Code2, Database, Eye, FileText, History, KeyRound, MessageSquare, MessageSquarePlus, RotateCcw, ScrollText, Send } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceHeader } from "./header";
import { Chat } from "./chat";
import { PlanPanel } from "./plan-panel";
import { CodePanel } from "./code-panel";
import { EnvPanel, LogsPanel } from "./dev-panels";
import { Tour } from "./tour";
import { FocusTips, MusicPlayer } from "./focus-mode";
import { DiffReview, type ProposedEdit } from "./diff-review";
import { codeAI } from "./code-panel";
import { BuildCard, ConnectCard, LiveCard, ShipCard, TestCard } from "./stage-cards";
import { AppPreview } from "@/components/app-preview/app-preview";
import { AgentCanvas } from "@/components/agents/agent-canvas";
import { AgentDrawer } from "@/components/agents/agent-drawer";
import { Button } from "@/components/ui/button";
import { askQuestions, deploy, finishBuild, generateUI, quickChange, revertTo, revisePlan, saveFile, savePlan, setConnection, setStage, submitAnswers, type Msg } from "@/lib/actions/workspace";
import { addComment, deleteComment, markComments, updateComment, type Comment } from "@/lib/actions/comments";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildSteps, testChecks } from "@/lib/script/build";
import { filesFor } from "@/lib/script/files";
import { projectSpend } from "@/lib/usage";
import type { AgentRow, FileRow, VersionRow } from "@/lib/workspace-types";
import type { Mode, Plan, Project, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMedia } from "@/hooks/use-media";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useDefaultLayout, useGroupRef, usePanelRef } from "react-resizable-panels";

type Tab = "plan" | "preview" | "agents" | "code" | "env" | "logs" | "data" | "versions";
const ORDER: Stage[] = ["plan", "connect", "build", "test", "ship", "live"];
const TEMPLATE_ANSWERS = "Use the recommended option for every question — this project started from a template.";

// Panel sizes persist per browser; storage can be missing (SSR) or blocked (private mode).
const safeStorage = {
  getItem: (k: string) => { try { return typeof window === "undefined" ? null : localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

/** Tell the user when a long build finishes while they're in another tab. */
function notifyDone(name: string) {
  document.title = `✓ ${name} is built — Architect`;
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(`${name} is built`, { body: "Your app passed its build. Come back to test and ship it." }); } catch {}
}

export function Workspace({ initial, defaultMode, otherSpend, workspaceConnections = [] }: {
  initial: { project: Project; messages: Msg[]; files: FileRow[]; agents: AgentRow[]; versions: VersionRow[]; comments: Comment[] };
  defaultMode: Mode;
  otherSpend: number;
  workspaceConnections?: string[];
}) {
  const [project, setProject] = useState(initial.project);
  const [messages, setMessages] = useState(initial.messages);
  const [files, setFiles] = useState(initial.files);
  const [agents, setAgents] = useState(initial.agents);
  const [versions, setVersions] = useState(initial.versions);
  const [comments, setComments] = useState(initial.comments);
  const [mode, setModeState] = useState<Mode>(defaultMode);
  const [view, setView] = useState<Stage>(project.stage === "live" ? "ship" : project.stage);
  const [tab, setTab] = useState<Tab>(project.stage === "plan" || project.stage === "connect" ? "plan" : "preview");
  const [busy, setBusy] = useState<string | null>(null);
  const [planFirst, setPlanFirst] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [openFile, setOpenFile] = useState("");
  const [codeEdit, setCodeEdit] = useState<ProposedEdit | null>(null);
  const [codeKey, setCodeKey] = useState(0);
  const [drawer, setDrawer] = useState<AgentRow | null>(null);
  const [mobilePane, setMobilePane] = useState<"chat" | "app">("chat");
  const desktop = useMedia("(min-width: 768px)");
  const layout = useDefaultLayout({ id: "architect-workspace", storage: safeStorage });
  const groupRef = useGroupRef();
  const chatPanel = usePanelRef();
  const [chatCollapsed, setChatCollapsed] = useState(() => (layout.defaultLayout?.chat ?? 32) < 6); // restored collapsed layout
  const plan = project.plan;
  const source = project.source ?? {};
  const framework = source.framework ?? "lyzr";
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
    if (m === "builder" && ["code", "env", "logs"].includes(tab)) setTab("preview");
    if (m === "developer" && project.stage === "build") setTab("code");
    toast(m === "developer" ? "Developer view — code, diffs, terminal, env and logs are open" : "Builder view — technical details hidden", { duration: 1800 });
  };

  const patch = (p: Partial<Project>) => setProject((x) => ({ ...x, ...p }));
  const goStage = async (s: Stage) => { patch({ stage: s }); setView(s === "live" ? "ship" : s); await setStage(project.id, s); };
  const push = (m: Msg[]) => setMessages((x) => [...x, ...m]);

  const onAnswer = useCallback(async (summary: string) => {
    setBusy("Writing your plan…");
    setTab("plan");
    try { const r = await submitAnswers(project.id, summary); setProject((x) => ({ ...x, plan: r.plan, name: r.plan.name, slug: r.slug })); setMessages((x) => [...x, ...r.messages]); }
    catch { toast.error("Couldn't write the plan. Please try again."); }
    setBusy(null);
  }, [project.id]);

  /* ---- Plan: ask clarifying questions once (templates skip straight to a plan) ---- */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || project.stage !== "plan" || plan || messages.some((m) => m.kind === "questions" || m.kind === "answers")) return;
    asked.current = true;
    // Kicks off the first server request for a fresh project (external sync) — the busy state is part of that request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (source.template) { void onAnswer(TEMPLATE_ANSWERS); return; }
    setBusy("Reading your idea…");
    askQuestions(project.id, mode === "developer").then((m) => { if (m) setMessages((x) => [...x, m]); }).finally(() => setBusy(null));
  }, [project.id, project.stage, plan, messages, source.template, onAnswer, mode]);

  const revise = async (instruction: string) => {
    setBusy("Updating the plan…"); setTab("plan");
    try { const r = await revisePlan(project.id, instruction); patch({ plan: r.plan, name: r.plan.name }); push(r.messages); }
    catch { toast.error("Couldn't update the plan."); }
    setBusy(null);
  };

  /** Real change request after the app is built: AI edits the screens, code and a version with a summary follow. */
  const change = async (text: string) => {
    setBusy("Changing your app…"); setTab("preview");
    try {
      const r = await quickChange(project.id, text);
      push(r.messages);
      patch({ plan: r.plan });
      if (r.files) setFiles(r.files);
      const ver = r.version;
      if (ver) setVersions((v) => [{ ...(ver.snapshot as object), id: ver.id, label: ver.label, created_at: ver.created_at } as VersionRow, ...v]);
      return true;
    } catch { toast.error("Couldn't apply that change."); return false; }
    finally { setBusy(null); }
  };

  /** In the Code tab the chat is code-aware: it answers about the open file and can propose a reviewed edit. */
  const askCode = async (question: string) => {
    const file = files.find((f) => f.path === openFile);
    if (!file) return toast("Open a file first.");
    const now = new Date().toISOString();
    push([{ id: crypto.randomUUID(), role: "user", kind: "code", content: question, meta: { file: file.path }, created_at: now }]);
    setBusy(`Reading ${file.path}…`);
    const r = await codeAI({ op: "chat", projectId: project.id, path: file.path, file: file.content, files: files.map((f) => f.path), question }).catch(() => ({ error: "Network error" }));
    setBusy(null);
    if (r.error) return toast.error(r.error);
    push([{ id: crypto.randomUUID(), role: "assistant", kind: "code", content: r.answer, meta: r.edit ? { edit: { path: file.path, original: file.content, modified: r.edit.content, summary: r.edit.summary } } : { file: file.path }, created_at: now }]);
  };

  const onSend = async (text: string) => {
    if (tab === "code" && mode === "developer" && reached >= ORDER.indexOf("test")) return askCode(text);
    if (!plan) return toast("Answer the questions above first, or pick the recommended options.");
    if (project.stage === "plan" || project.stage === "connect" || planFirst) return revise(text);
    if (project.stage === "build") return toast("Hang on — I'm still building. Ask again in a moment.");
    await change(text);
  };

  /* ---- Connect ---- */
  const onSetConnection = async (id: string, s: "connected" | "sample") => { const r = await setConnection(project.id, id, s); patch(r); };

  /* ---- Build: timeline + real UI generation in parallel ---- */
  const steps = useMemo(() => (plan ? buildSteps(plan, framework) : []), [plan, framework]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [terminal, setTerminal] = useState<string[]>([]);
  const [uiReady, setUiReady] = useState(() => !!plan?.screens.every((s) => s.blocks?.length));
  const finishing = useRef(false);
  const buildStarted = useRef(0);
  const generating = useRef(false);
  const building = project.stage === "build";

  useEffect(() => {
    if (!building || uiReady || generating.current) return;
    generating.current = true;
    generateUI(project.id)
      .then((r) => { setProject((x) => ({ ...x, plan: r.plan })); setTerminal((t) => [...t, `  ✓ ${r.plan.screens.length} screens laid out by ${r.live ? "AI" : "offline template"}`]); })
      .catch(() => toast.error("Screen generation failed — using a basic layout."))
      .finally(() => setUiReady(true));
  }, [building, uiReady, project.id]);

  useEffect(() => {
    if (!building || paused || !steps.length) return;
    if (at >= steps.length) {
      if (finishing.current || !uiReady) return;
      finishing.current = true;
      finishBuild(project.id, (Date.now() - buildStarted.current) / 1000).then((r) => {
        setFiles(r.files); setAgents(r.agents); push([r.message]);
        setVersions((v) => [{ id: crypto.randomUUID(), label: "First build", created_at: new Date().toISOString(), summary: "First build." }, ...v]);
        patch({ stage: "test", source: { ...(project.source ?? {}), build: { seconds: Math.round((Date.now() - buildStarted.current) / 1000), at: new Date().toISOString() } } }); setView("test");
        notifyDone(project.name);
        toast.success("Build finished — testing now");
      });
      return;
    }
    const s = steps[at];
    if (s.reveal !== undefined && !uiReady) return; // a screen is "built" only once the AI has actually laid it out
    const t = setTimeout(() => { setTerminal((x) => [...x, ...(s.terminal ?? [])]); setAt((a) => a + 1); }, s.ms);
    return () => clearTimeout(t);
  }, [building, paused, at, steps, project.id, uiReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const startBuild = async () => {
    setAt(0); setTerminal([]); finishing.current = false; generating.current = false; setUiReady(false); buildStarted.current = Date.now();
    setTab(mode === "developer" ? "code" : "preview");
    setMobilePane("chat");
    try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch {}
    await goStage("build");
  };

  const revealed = !plan ? 0 : building ? steps.slice(0, at).filter((s) => s.reveal !== undefined).length : reached >= ORDER.indexOf("test") ? plan.screens.length : 0;
  const liveFiles: FileRow[] = useMemo(() => {
    if (!building || !plan) return files;
    const done = new Set(steps.slice(0, at + 1).map((s) => s.file).filter(Boolean));
    return filesFor(plan, framework).filter((f, i) => (at > 0 && ["AGENTS.md", "app/layout.tsx", "lib/agents.ts", ".env.example"].includes(f.path)) || done.has(f.path) || (i === 0 && at > 0));
  }, [building, plan, steps, at, files, framework]);
  const writing = building ? steps[at]?.file : undefined;
  const remaining = Math.round(steps.slice(at).reduce((a, s) => a + s.ms, 0) / 1000);

  /* ---- Comments on the preview ---- */
  const openComments = comments.filter((c) => c.status === "open");
  const onEditComment = async (id: string, body: string) => { setComments((x) => x.map((c) => (c.id === id ? { ...c, body } : c))); await updateComment(id, body); };
  const onDeleteComment = async (id: string) => { setComments((x) => x.filter((c) => c.id !== id)); await deleteComment(id); toast("Comment deleted"); };
  const [reviewComments, setReviewComments] = useState(false);
  const onComment = async (t: { screen: string; target: string }, body: string) => {
    try { const c = await addComment(project.id, t.screen, t.target, body); setComments((x) => [...x, c]); toast.success("Comment added"); }
    catch { toast.error("Couldn't save the comment (has migration 0002 been run?)"); }
  };
  const sendComments = async () => {
    const text = `Apply this feedback from comments on the app:\n${openComments.map((c) => `- On "${c.screen}" › "${c.target}": ${c.body}`).join("\n")}`;
    const ids = openComments.map((c) => c.id);
    if (await change(text)) { await markComments(ids, "sent"); setComments((x) => x.map((c) => (ids.includes(c.id) ? { ...c, status: "sent" } : c))); setCommenting(false); }
  };

  /* ---- Ship ---- */
  const onDeploy = async (t: "preview" | "production") => {
    const msg = await deploy(project.id, t);
    setVersions((v) => [{ id: crypto.randomUUID(), label: t === "production" ? "Published to production" : "Preview deployment", created_at: new Date().toISOString() }, ...v]);
    if (t === "production") { patch({ stage: "live" }); toast.success("You're live!"); } else toast.success("Preview deployed");
    push([msg]);
  };

  const openAgent = useCallback((name: string) => {
    const a = agents.find((x) => x.name === name);
    if (a) setDrawer(a); else toast("This agent will be created when you build.");
  }, [agents]);

  const codeChat = tab === "code" && mode === "developer" && reached >= ORDER.indexOf("test");
  const placeholder = codeChat ? `Ask about ${openFile || "this file"} or ask for a change…` : !plan ? "Or describe anything else you want…" : project.stage === "plan" ? "Ask for changes to the plan…" : planFirst ? "Describe a change — I'll update the plan first…" : "Ask for a change, e.g. “add a search box to the inbox”…";
  const credits = Math.max(0, 20 - otherSpend - projectSpend(project));
  const later = plan?.scope.filter((s) => s.status === "later").map((s) => s.item) ?? [];

  const stageCard = () => {
    if (!plan) return null;
    if (ORDER.indexOf(view) > reached) return null;
    if (view === "connect") return <ConnectCard plan={plan} project={project} onSet={onSetConnection} onStart={startBuild} reusable={workspaceConnections} built={reached > ORDER.indexOf("build")} />;
    if (view === "build") return building ? <BuildCard steps={steps} at={at} mode={mode} paused={paused} onPause={() => setPaused((p) => !p)} remaining={remaining} waitingForAI={!uiReady && steps[at]?.reveal !== undefined}
      focus={<FocusTips done={at >= steps.length} tips={[
        { label: "Re-read your plan", onClick: () => setTab("plan") },
        mode === "developer" ? { label: "Watch the code being written", onClick: () => setTab("code") } : { label: "Watch screens appear", onClick: () => setTab("preview") },
        ...(project.demo_data ? [{ label: "Connect real accounts", onClick: () => setView("connect") }] : []),
      ]} />} /> : <BuildCard steps={steps} at={steps.length} mode={mode} paused={false} onPause={() => {}} remaining={0} />;
    if (view === "test") return <TestCard checks={testChecks(plan, project.demo_data)} mode={mode} onFix={() => setView("connect")} onPlayground={() => { setTab("agents"); if (agents[0]) setDrawer(agents[0]); }} onContinue={() => goStage("ship")} />;
    if (view === "ship") return project.stage === "live" ? <LiveCard project={project} later={later} onAddBack={(s) => change(`Add this from the plan's "later" list: ${s}`)} /> : <ShipCard project={project} onDeploy={onDeploy} onFixConnections={() => setView("connect")} />;
    return null;
  };

  const TABS: { id: Tab; label: string; icon: typeof Eye; dev?: boolean }[] = [
    { id: "plan", label: "Plan", icon: FileText },
    { id: "preview", label: "Preview", icon: Eye },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "code", label: "Code", icon: Code2, dev: true },
    { id: "env", label: "Env", icon: KeyRound, dev: true },
    { id: "logs", label: "Logs", icon: ScrollText, dev: true },
    { id: "data", label: "Data", icon: Database },
    { id: "versions", label: "Versions", icon: History },
  ];
  const canComment = reached >= ORDER.indexOf("test");

  const chatNode = (
    <>
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
      <span className="text-xs font-medium text-muted-foreground">Chat with Architect</span>
      <MusicPlayer />
    </div>
    <div className="min-h-0 flex-1">
          <Chat messages={messages} busy={!!busy} busyLabel={busy ?? ""} placeholder={placeholder} onSend={onSend}
      context={codeChat && openFile ? `@${openFile}` : undefined} onReviewEdit={(e) => setCodeEdit(e as ProposedEdit)}
      onAnswer={(a, m) => (m.meta?.forChange ? change(`${m.meta.forChange}\nClarification from the user: ${a}`) : onAnswer(a))} planToggle={planFirst} onPlanToggle={setPlanFirst}>
      {stageCard()}
    </Chat>
    </div>
    </>
  );

  const appNode = (
    <>
          <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
            {TABS.filter((t) => !t.dev || mode === "developer").map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground", tab === t.id && "bg-muted font-medium text-foreground", t.dev && "text-dev")}>
                <t.icon className="size-3.5" />{t.label}
              </button>
            ))}
            {tab === "preview" && canComment && (
              <div className="ml-auto flex items-center gap-2">
                {openComments.length > 0 && <Button size="xs" onClick={() => setReviewComments(true)} disabled={!!busy}><Send /> Review &amp; send {openComments.length}</Button>}
                <Button size="xs" variant={commenting ? "default" : "outline"} onClick={() => setCommenting((c) => !c)}><MessageSquarePlus /> {commenting ? "Done commenting" : "Comment"}</Button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
            {tab === "plan" && <PlanPanel plan={plan} mode={mode} framework={framework} busy={!!busy} canApprove={project.stage === "plan"} canEdit={project.stage === "plan" || project.stage === "connect"}
              actual={reached >= ORDER.indexOf("test") ? { spent: projectSpend(project), seconds: source.build?.seconds } : undefined}
              onApprove={() => { goStage("connect"); toast.success("Plan approved"); }} onAddBack={(item) => revise(`Add back: ${item}`)}
              onSave={async (p, via) => {
                patch({ plan: p, name: p.name }); // optimistic
                const r = await savePlan(project.id, p, via).catch(() => ({ error: "Couldn't save the plan" }));
                if ("error" in r) { toast.error(r.error); patch({ plan }); return false; }
                patch({ plan: r.plan, name: r.plan.name }); return true;
              }} />}
            {tab === "preview" && (plan && (revealed || building) ? (
              <div className="h-full p-4">
                {commenting && <p className="mb-2 text-center text-xs text-muted-foreground">Click any part of the app to leave a comment. Send them to Architect when you&apos;re done.</p>}
                <AppPreview plan={plan} revealed={revealed} demo={project.demo_data} building={building} projectId={reached >= ORDER.indexOf("test") ? project.id : undefined}
                  commenting={commenting} comments={openComments} onComment={onComment} onEditComment={onEditComment} onDeleteComment={onDeleteComment} />
              </div>
            ) : <EmptyPreview stage={plan ? project.stage : "plan"} />)}
            {tab === "agents" && (plan ? <AgentCanvas plan={plan} framework={framework} built={agents.length > 0} onOpen={openAgent} /> : <EmptyPreview stage="plan" />)}
            {tab === "code" && <CodePanel key={codeKey} files={liveFiles} locked={building && !paused} terminal={terminal} writing={writing} name={project.slug}
              projectId={project.id} onOpenFile={setOpenFile} onAsk={(q) => { void askCode(q); }}
              onSave={(p, c) => { setFiles((fs) => fs.map((f) => (f.path === p ? { ...f, content: c } : f))); return saveFile(project.id, p, c); }} />}
            {tab === "env" && <EnvPanel project={project} plan={plan} />}
            {tab === "logs" && <LogsPanel projectId={project.id} terminal={terminal} />}
            {tab === "data" && <DataPanel plan={plan} demo={project.demo_data} mode={mode} />}
            {tab === "versions" && <VersionsPanel versions={versions} mode={mode} onRevert={async (v) => {
              const r = await revertTo(project.id, v.id);
              setFiles(r.files); if (r.plan) patch({ plan: r.plan as Plan });
              setVersions((x) => [{ id: crypto.randomUUID(), label: `Restored “${v.label}”`, created_at: new Date().toISOString(), summary: `Went back to “${v.label}”.` }, ...x]);
              toast.success(`Restored “${v.label}”`);
            }} />}
          </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col">
      <WorkspaceHeader project={project} mode={mode} onMode={setMode} view={view} onView={setView} credits={credits} />
      <div className={cn("flex border-b", desktop && "hidden")}>
        {(["chat", "app"] as const).map((p) => (
          <button key={p} onClick={() => setMobilePane(p)} className={cn("flex flex-1 items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground", mobilePane === p && "border-b-2 border-foreground font-medium text-foreground")}>
            {p === "chat" ? <MessageSquare className="size-4" /> : <Eye className="size-4" />}{p === "chat" ? "Chat" : "App"}
          </button>
        ))}
      </div>
      {desktop ? (
        <ResizablePanelGroup id="architect-workspace" orientation="horizontal" className="min-h-0 flex-1" defaultLayout={layout.defaultLayout} onLayoutChanged={layout.onLayoutChanged} groupRef={groupRef}>
          <ResizablePanel id="chat" defaultSize="32%" minSize="260px" maxSize="60%" collapsible collapsedSize="44px" panelRef={chatPanel}
            onResize={(size) => setChatCollapsed(size.inPixels < 60)}>
            {chatCollapsed ? (
              <button onClick={() => chatPanel.current?.expand()} aria-label="Show chat" className="flex h-full w-full flex-col items-center gap-2 border-r bg-card pt-4 text-muted-foreground hover:text-foreground">
                <MessageSquare className="size-4" /><span className="text-[10px] [writing-mode:vertical-rl]">Chat</span>
              </button>
            ) : (
              <section className="flex h-full min-h-0 flex-col" aria-label="Chat with Architect">{chatNode}</section>
            )}
          </ResizablePanel>
          <ResizableHandle withHandle onDoubleClick={() => groupRef.current?.setLayout({ chat: 32, app: 68 })} title="Drag to resize · double-click to reset" />
          <ResizablePanel id="app" minSize="360px">
            <section className="flex h-full min-h-0 min-w-0 flex-col" aria-label="Your app">{appNode}</section>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className={cn("min-h-0 w-full flex-col", mobilePane === "chat" ? "flex" : "hidden")} aria-label="Chat with Architect">{chatNode}</section>
          <section className={cn("min-h-0 min-w-0 flex-1 flex-col", mobilePane === "app" ? "flex" : "hidden")} aria-label="Your app">{appNode}</section>
        </div>
      )}
      <Dialog open={reviewComments} onOpenChange={setReviewComments}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Send {openComments.length} comment{openComments.length === 1 ? "" : "s"} to Architect</DialogTitle>
            <DialogDescription>Architect applies them as one change and saves a version you can roll back.</DialogDescription></DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {openComments.map((c) => (
              <li key={c.id} className="rounded-lg border p-2.5 text-sm">
                <div className="text-[11px] text-muted-foreground">{c.screen} › {c.target}</div>
                <textarea defaultValue={c.body} rows={2} aria-label="Comment" onBlur={(e) => e.target.value.trim() && e.target.value !== c.body && onEditComment(c.id, e.target.value.trim())}
                  className="mt-1 w-full resize-none rounded-md border bg-background p-1.5 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
                <button onClick={() => onDeleteComment(c.id)} className="mt-1 text-xs text-muted-foreground hover:text-destructive">Remove</button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReviewComments(false)}>Keep editing</Button>
            <Button disabled={!openComments.length || !!busy} onClick={() => { setReviewComments(false); void sendComments(); }}><Send /> Send to Architect</Button>
          </div>
        </DialogContent>
      </Dialog>
      <DiffReview edit={codeEdit} onClose={() => setCodeEdit(null)} onAccept={async (e) => {
        setFiles((fs) => fs.map((f) => (f.path === e.path ? { ...f, content: e.modified } : f)));
        await saveFile(project.id, e.path, e.modified);
        setCodeKey((k) => k + 1); setCodeEdit(null); toast.success(`Updated ${e.path}`);
      }} />
      <AgentDrawer agent={drawer} mode={mode} open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)} onChange={(a) => setAgents((xs) => xs.map((x) => (x.id === a.id ? a : x)))} />
      <Tour />
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
        <li key={v.id} className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-3">
            <span className={cn("size-2 shrink-0 rounded-full", i === 0 ? "bg-brand" : "bg-border")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{v.label}</div>
              <div className="text-xs text-muted-foreground" suppressHydrationWarning>{new Date(v.created_at).toLocaleString()}{mode === "developer" && <> · <span className="font-mono">{v.id.slice(0, 7)}</span></>}</div>
            </div>
            {i === 0 ? <span className="text-xs text-muted-foreground">Current</span> : <Button size="xs" variant="outline" onClick={() => onRevert(v)}><RotateCcw /> Restore</Button>}
          </div>
          {mode === "builder" && v.changes && v.changes.length > 0 && (
            <ul className="mt-2 ml-5 space-y-0.5 text-xs text-muted-foreground">{v.changes.map((c) => <li key={c}>• {c}</li>)}</ul>
          )}
          {mode === "developer" && v.diff && v.diff.length > 0 && (
            <ul className="mt-2 ml-5 space-y-0.5 font-mono text-[11px]">{v.diff.map((d) => <li key={d.path}>{d.path} <span className="text-success">+{d.added}</span> <span className="text-destructive">−{d.removed}</span></li>)}</ul>
          )}
        </li>
      ))}
    </ol>
  );
}
