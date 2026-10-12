"use server";
import { requireUser } from "@/lib/supabase/server";
import { GatewayError, generate, type ChatMessage } from "@/lib/ai/gateway";
import { MAX_STEPS, TOOLS, compact, noToolCalls, runTool, scaffold, systemPrompt, type BuildEvent, type StepState } from "@/lib/ai/builder";
import { APP_DIR, createSandbox, getSandbox, listFiles, readFile, run, sandboxesEnabled, startPreview, writeFiles } from "@/lib/sandbox";
import { logUsage, outOfCredits } from "@/lib/usage-log";
import { completeBuild } from "@/lib/complete-build";
import type { Check, Project } from "@/lib/types";

/**
 * Real builds: an AI agent writes the app inside a Vercel Sandbox and doesn't stop until `vite build` passes.
 * The job lives in build_runs; each buildStep() is one model call + its tool calls, short enough for a serverless
 * function. The browser calls it in a loop (and resumes after a reload) — in production a queue worker would.
 */
export type RunRow = { id: string; project_id: string; status: "running" | "done" | "failed"; request: string | null; sandbox: string; step: number; history: ChatMessage[]; events: BuildEvent[]; usage: { tokens?: number; cost?: number; model?: string }; preview_url: string | null; created_at: string };

const touch = () => new Date().toISOString();

/** The first build (fresh sandbox), or — with `request` — a change made by the same agent in the app's existing sandbox. */
export async function startRealBuild(projectId: string, request?: string) {
  if (!sandboxesEnabled()) return { error: "Sandboxes aren't configured on this deployment." };
  const { supabase, profile } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single<Project>();
  if (!project?.plan?.screens.length) return { error: "Only apps with screens build in a sandbox." };
  const broke = await outOfCredits(supabase, profile?.bonus_credits);
  if (broke) return { error: broke };
  const { data: running } = await supabase.from("build_runs").select("*").eq("project_id", projectId).eq("status", "running").maybeSingle<RunRow>();
  if (running) return { run: running }; // resume after a reload
  if (request) return startChange(supabase, project, request.slice(0, 2000));

  const sb = await createSandbox();
  await writeFiles(sb, scaffold(project.plan));
  const install = await run(sb, "npm", ["install", "--no-audit", "--no-fund"], 1500);
  if (!install.ok) { await sb.stop(); return { error: "Couldn't install dependencies in the sandbox." }; }
  const events: BuildEvent[] = [{ t: "note", text: "Started a Vercel Sandbox (Firecracker microVM)" }, { t: "note", text: "Installed React 19 + Vite" }];
  const history: ChatMessage[] = [{ role: "user", content: "Build the app now." }];
  const { data, error } = await supabase.from("build_runs").insert({ project_id: projectId, sandbox: sb.name, history, events }).select().single<RunRow>();
  if (error) { await sb.stop(); return { error: /build_runs/.test(error.message) ? "Real builds need migration 0006 — run it in Supabase." : "Couldn't start the build." }; }
  return { run: data };
}

async function startChange(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], project: Project, request: string) {
  const name = project.source?.preview?.sandbox;
  if (!name) return { error: "This app wasn't built in a sandbox." };
  const sb = await getSandbox(name);
  await sb.extendTimeout(20 * 60 * 1000).catch(() => {}); // resumes a paused sandbox, files and node_modules intact
  const history: ChatMessage[] = [{ role: "user", content: `Change request from the user: "${request}". The app already exists. Read only the files you need, make the change, run_build, then finish with one sentence describing what changed.` }];
  const events: BuildEvent[] = [{ t: "note", text: "Applying your change in the same sandbox" }];
  const { data, error } = await supabase.from("build_runs").insert({ project_id: project.id, sandbox: name, request, history, events }).select().single<RunRow>();
  if (error) return { error: "Couldn't start the change." };
  const { data: message } = await supabase.from("messages").insert({ project_id: project.id, role: "user", kind: "text", content: request }).select().single();
  return { run: data, message };
}

/** Code changed since the last passing build? (derived from the events, so nothing extra is stored) */
const dirtyAfter = (events: BuildEvent[]) => {
  const lastPass = events.findLastIndex((e) => e.t === "build" && e.ok);
  return lastPass < 0 || events.slice(lastPass).some((e) => e.t === "file");
};

type Finished = { files: { path: string; content: string }[]; agents: unknown[] | null; message: unknown; source: unknown; version?: { id: string; label: string; created_at: string } | null };
type StepResult = { events: BuildEvent[]; step: number; status: RunRow["status"]; usage: RunRow["usage"]; result?: Finished & { preview: string } };

export async function buildStep(runId: string): Promise<StepResult | { error: string }> {
  const { supabase } = await requireUser();
  const { data: r } = await supabase.from("build_runs").select("*, project:projects(*)").eq("id", runId).single<RunRow & { project: Project }>();
  if (!r || r.status !== "running") return { error: "This build isn't running." };
  const sb = await getSandbox(r.sandbox);
  const state: StepState = { history: r.history, dirty: dirtyAfter(r.events) };
  const events: BuildEvent[] = [];
  let usage = null;
  try {
    const res = await generate({ system: systemPrompt(r.project.plan!), messages: compact(state.history), tools: TOOLS, effort: "low", maxTokens: 4500 });
    usage = res.usage;
    state.history.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls, raw: res.raw });
    for (const call of res.toolCalls) {
      const out = await runTool(sb, call, state, events).catch((e) => `Tool failed: ${e instanceof Error ? e.message : e}`);
      state.history.push({ role: "tool", toolCallId: call.id, content: out });
    }
    if (!res.toolCalls.length) noToolCalls(state, res.text);
  } catch (e) {
    events.push({ t: "error", text: e instanceof GatewayError ? e.message : "The AI step failed — retrying." }); // transient: the next step tries again
  }
  if (usage) await logUsage(supabase, r.project_id, "build", [usage]);
  const totals = { tokens: (r.usage.tokens ?? 0) + (usage ? usage.input_tokens + usage.output_tokens : 0), cost: (r.usage.cost ?? 0) + (usage?.cost_usd ?? 0), model: usage?.model ?? r.usage.model };
  const step = r.step + 1;
  const allEvents = [...r.events, ...events];

  if (state.done) return finish(supabase, { ...r, step, events: allEvents, history: state.history, usage: totals }, state.done, events);
  const status: RunRow["status"] = step >= MAX_STEPS ? "failed" : "running";
  if (status === "failed") { events.push({ t: "error", text: `Stopped after ${MAX_STEPS} steps without a passing build.` }); allEvents.push(events.at(-1)!); await sb.stop().catch(() => {}); }
  await supabase.from("build_runs").update({ step, history: state.history, events: allEvents, usage: totals, status, updated_at: touch() }).eq("id", runId);
  return { events, step, status, usage: totals };
}

async function finish(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], r: RunRow & { project: Project }, summary: string, events: BuildEvent[]): Promise<StepResult> {
  const sb = await getSandbox(r.sandbox);
  const preview = await startPreview(sb);
  const paths = (await listFiles(sb)).filter((p) => /^(src\/|index\.html$|package\.json$|vite\.config\.js$)/.test(p));
  const files = (await Promise.all(paths.map(async (path) => ({ path, content: (await readFile(sb, path)) ?? "" })))).filter((f) => f.content.length < 200_000);
  const screens = paths.filter((p) => p.startsWith("src/screens/")).length;
  const checks: Check[] = [
    { label: "Production build passes", dev: "vite build → exit 0", ok: true },
    { label: "The app is running", dev: `GET / → ${preview.up ? "200" : "no response"}`, ok: preview.up },
    { label: `${screens} screen${screens === 1 ? "" : "s"} written by the build agent`, dev: `${files.length} files in ${APP_DIR}`, ok: screens > 0 ? true : "warn" },
    { label: "Agents ask before they act", dev: "drafts only — nothing is sent", ok: true },
  ];
  const seconds = (Date.now() - new Date(r.created_at).getTime()) / 1000;
  // ponytail: bills provisioned memory for the build only (2 vCPU × 2 GB at $0.0212/GB-h); active CPU is reported when the sandbox stops.
  await logUsage(supabase, r.project_id, "sandbox", [{ model: "vercel-sandbox", input_tokens: 0, output_tokens: 0, ms: Math.round(seconds * 1000), cost_usd: 4 * (seconds / 3600) * 0.0212 }]);
  const done = r.request ? await saveChange(supabase, r.project, files, summary, preview.url) : await completeBuild(supabase, r.project, files, seconds, { summary, checks, preview: { sandbox: r.sandbox, url: preview.url } });
  events.push({ t: "done", summary, url: preview.url });
  await supabase.from("build_runs").update({ step: r.step, history: r.history, events: [...r.events, events.at(-1)], usage: r.usage, status: "done", preview_url: preview.url, updated_at: touch() }).eq("id", r.id);
  return { events, step: r.step, status: "done" as const, usage: r.usage, result: { ...done, preview: preview.url } };
}

/** A finished change: the sandbox's files replace the saved code, as a version with the agent's summary. */
async function saveChange(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], project: Project, files: { path: string; content: string }[], summary: string, url: string) {
  const touchedAt = touch();
  await supabase.from("files").delete().eq("project_id", project.id);
  await supabase.from("files").insert(files.map((f) => ({ project_id: project.id, path: f.path, content: f.content, updated_at: touchedAt })));
  const { data: version } = await supabase.from("versions").insert({ project_id: project.id, label: summary.slice(0, 80), snapshot: { files, plan: project.plan, summary } }).select("id, label, created_at").single();
  const { data: message } = await supabase.from("messages").insert({ project_id: project.id, role: "assistant", kind: "text", content: `${summary} The build passes and the running app is updated.` }).select().single();
  const source = { ...(project.source ?? {}), preview: { ...project.source!.preview!, url } };
  await supabase.from("projects").update({ source, updated_at: touchedAt }).eq("id", project.id);
  return { files, agents: null, message, source, version };
}

export async function cancelBuild(runId: string) {
  const { supabase } = await requireUser();
  const { data: r } = await supabase.from("build_runs").update({ status: "failed", updated_at: touch() }).eq("id", runId).eq("status", "running").select("sandbox").maybeSingle();
  if (r?.sandbox) await (await getSandbox(r.sandbox)).stop().catch(() => {});
}

/** Wake the project's sandbox (it pauses when idle) and make sure the dev server is up. */
export async function wakePreview(projectId: string) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("projects").select("source").eq("id", projectId).single<Pick<Project, "source">>();
  const name = p?.source?.preview?.sandbox;
  if (!name || !sandboxesEnabled()) return { error: "No sandbox for this project." };
  try {
    const sb = await getSandbox(name);
    await sb.extendTimeout(20 * 60 * 1000).catch(() => {}); // give the person time to look around
    return await startPreview(sb);
  } catch {
    return { error: "The sandbox couldn't start — rebuild to get a fresh one." };
  }
}
