"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { Monaco as MonacoApi, OnMount } from "@monaco-editor/react";
import { Download, FileCode2, FileText, Folder, Loader2, Lock, Sparkles, Terminal, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { FileRow } from "@/lib/workspace-types";
import { Switch } from "@/components/ui/switch";
import { DiffReview, type ProposedEdit } from "./diff-review";
import { cn } from "@/lib/utils";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> });

const lang = (p: string) => (p.endsWith(".py") ? "python" : p.endsWith(".sql") ? "sql" : p.endsWith(".md") ? "markdown" : p.endsWith(".ts") || p.endsWith(".tsx") ? "typescript" : "plaintext");
const LANGS = ["typescript", "python", "sql", "markdown", "plaintext"];

/** Real export: the project's current files as a zip — you own the code. */
async function downloadZip(files: FileRow[], name: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.content));
  const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.zip` });
  a.click();
  URL.revokeObjectURL(url);
}

export const codeAI = (body: Record<string, unknown>) => fetch("/api/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

/** Models sometimes restate the start of the line ("const hours = …"); drop whatever already sits before the cursor. */
export function trimOverlap(lineBefore: string, completion: string) {
  const line = lineBefore.trimStart();
  for (let n = Math.min(line.length, completion.length); n > 0; n--) if (completion.startsWith(line.slice(-n))) return completion.slice(n);
  return completion;
}

// Monaco providers are global per page; register once and read the live editor state from these refs.
const live = { projectId: "", path: "", enabled: true, locked: false };
let registered = false;
function registerCopilot(m: MonacoApi) {
  if (registered) return;
  registered = true;
  const provider = {
    provideInlineCompletions: async (model: { getValueInRange: (r: object) => string; getLineCount: () => number; getLineMaxColumn: (l: number) => number; getLineContent: (l: number) => string }, pos: { lineNumber: number; column: number }, _ctx: unknown, token: { isCancellationRequested: boolean }) => {
      if (!live.enabled || live.locked || !live.projectId) return { items: [] };
      await new Promise((r) => setTimeout(r, 450)); // wait for a typing pause; stale requests get cancelled
      if (token.isCancellationRequested) return { items: [] };
      const last = model.getLineCount();
      const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: pos.lineNumber, endColumn: pos.column });
      const suffix = model.getValueInRange({ startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: last, endColumn: model.getLineMaxColumn(last) });
      if (!model.getLineContent(pos.lineNumber).trim() && !prefix.trim()) return { items: [] };
      try {
        const { text: raw } = await codeAI({ op: "complete", projectId: live.projectId, path: live.path, prefix, suffix });
        const text = trimOverlap(model.getLineContent(pos.lineNumber).slice(0, pos.column - 1), raw ?? "");
        if (token.isCancellationRequested || !text.trim()) return { items: [] };
        return { items: [{ insertText: text, range: new m.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column) }] };
      } catch { return { items: [] }; }
    },
    freeInlineCompletions: () => {},
    disposeInlineCompletions: () => {},
  };
  LANGS.forEach((l) => m.languages.registerInlineCompletionsProvider(l, provider as never));
}

type Editor = Parameters<OnMount>[0];

export function CodePanel({ files, locked, terminal, onSave, writing, name = "project", projectId, onOpenFile, onAsk }: {
  files: FileRow[]; locked: boolean; terminal: string[]; onSave: (path: string, content: string) => Promise<void>; writing?: string; name?: string;
  projectId: string; onOpenFile?: (path: string) => void; onAsk?: (question: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [picked, setOpen] = useState<string>(files[0]?.path ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [copilot, setCopilot] = useState(true);
  const [prompt, setPrompt] = useState<{ selection: string; range: object } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ProposedEdit | null>(null);
  const editor = useRef<Editor | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const termEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { termEnd.current?.scrollIntoView({ block: "end" }); }, [terminal.length]);

  const tree = useMemo(() => {
    const groups: Record<string, FileRow[]> = {};
    files.forEach((f) => { const dir = f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : ""; (groups[dir] ??= []).push(f); });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  // Follow the file the AI is writing; otherwise the user's pick (falling back to the first file).
  const open = writing && files.some((f) => f.path === writing) ? writing : files.some((f) => f.path === picked) ? picked : files[0]?.path ?? "";
  const current = files.find((f) => f.path === open);
  const value = drafts[open] ?? current?.content ?? "";

  useEffect(() => { Object.assign(live, { projectId, path: open, enabled: copilot, locked }); onOpenFile?.(open); }, [projectId, open, copilot, locked, onOpenFile]);

  const persist = (path: string, v: string) => {
    setDrafts((d) => ({ ...d, [path]: v }));
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await onSave(path, v); setSaved("saved"); }, 800);
  };
  const change = (v?: string) => { if (!locked && v !== undefined) persist(open, v); };

  const onMount: OnMount = (ed, m) => {
    editor.current = ed;
    registerCopilot(m);
    const openPrompt = () => {
      const sel = ed.getSelection();
      const model = ed.getModel();
      if (!sel || !model) return;
      const range = sel.isEmpty() ? model.getFullModelRange() : sel;
      setPrompt({ selection: model.getValueInRange(range), range }); setInstruction("");
    };
    ed.addAction({ id: "architect.edit", label: "Edit with AI…", keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.KeyK], contextMenuGroupId: "1_ai", run: openPrompt });
    ed.addAction({ id: "architect.fix", label: "Fix with AI", contextMenuGroupId: "1_ai", run: () => { openPrompt(); setInstruction("Find and fix bugs or mistakes in this code. Keep behaviour otherwise identical."); } });
    ed.addAction({ id: "architect.explain", label: "Explain in chat", contextMenuGroupId: "1_ai", run: () => {
      const sel = ed.getSelection(); const model = ed.getModel();
      if (sel && model && !sel.isEmpty()) onAsk?.(`Explain this code from ${live.path}:\n${model.getValueInRange(sel)}`);
      else onAsk?.(`Explain what ${live.path} does.`);
    } });
  };

  const runEdit = async () => {
    if (!prompt || !instruction.trim()) return;
    setBusy(true);
    const r = await codeAI({ op: "edit", projectId, path: open, file: value, selection: prompt.selection, instruction }).catch(() => ({ error: "Network error" }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    const model = editor.current?.getModel();
    if (!model) return;
    // Build the full proposed file by swapping the selection, then review it as a diff.
    const range = prompt.range as { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
    const before = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: range.startLineNumber, endColumn: range.startColumn });
    const last = model.getLineCount();
    const after = model.getValueInRange({ startLineNumber: range.endLineNumber, startColumn: range.endColumn, endLineNumber: last, endColumn: model.getLineMaxColumn(last) });
    setReview({ path: open, original: value, modified: before + r.code + after, summary: r.summary });
    setPrompt(null);
  };

  if (!files.length)
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Files appear here as soon as the build starts writing them.</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-end gap-2 border-b px-3 text-xs">
        <label className="mr-auto flex items-center gap-1.5 text-muted-foreground" title="Ghost-text suggestions as you type. Tab to accept.">
          <Sparkles className="size-3.5 text-dev" /> AI autocomplete <Switch checked={copilot} onCheckedChange={setCopilot} className="scale-75" aria-label="AI autocomplete" />
        </label>
        <span className="hidden text-muted-foreground lg:inline"><kbd className="rounded border px-1 font-mono">⌘K</kbd> edit with AI · right-click for more</span>
        <button onClick={() => { navigator.clipboard.writeText(`npx @architect/cli pull ${name} && cursor ${name}`); toast("Command copied — run it in your terminal to open this project in Cursor"); }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Terminal className="size-3.5" /> Open in Cursor</button>
        <button disabled={locked} onClick={() => downloadZip(files, name)} className="flex items-center gap-1.5 rounded-md border px-2 py-1 hover:bg-muted disabled:opacity-50"><Download className="size-3.5" /> Download code</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] grid-rows-[1fr_150px]">
        <aside className="row-span-2 overflow-y-auto border-r py-2 text-xs">
          <div className="px-3 pb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Files</div>
          {tree.map(([dir, list]) => (
            <div key={dir}>
              {dir && <div className="flex items-center gap-1.5 px-3 py-1 text-muted-foreground"><Folder className="size-3.5" />{dir}</div>}
              {list.map((f) => (
                <button key={f.path} onClick={() => setOpen(f.path)} className={cn("flex w-full items-center gap-1.5 py-1 pr-2 text-left hover:bg-muted", dir ? "pl-7" : "pl-3", open === f.path && "bg-muted font-medium")}>
                  {f.path.endsWith(".md") ? <FileText className="size-3.5 shrink-0" /> : <FileCode2 className="size-3.5 shrink-0" />}
                  <span className="truncate">{f.path.split("/").pop()}</span>
                  {writing === f.path && <span className="ml-auto size-1.5 shrink-0 animate-pulse rounded-full bg-dev" />}
                  {drafts[f.path] !== undefined && writing !== f.path && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-brand" title="Edited" />}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div className="relative flex min-h-0 flex-col">
          <div className="flex h-8 items-center justify-between border-b px-3 text-xs">
            <span className="font-mono">{open}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {locked ? <><Lock className="size-3" /> AI is writing — pause to edit</> : saved === "saving" ? "Saving…" : saved === "saved" ? "Saved ✓" : "Editable"}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <Monaco path={open} onMount={onMount}
              beforeMount={(m) => {
                // Generated files reference project modules Monaco can't see; keep syntax checks, drop false "cannot find module" errors.
                const ts = m.languages.typescript;
                ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
                ts.typescriptDefaults.setCompilerOptions({ jsx: ts.JsxEmit.Preserve, allowNonTsExtensions: true, target: ts.ScriptTarget.ESNext });
              }} language={lang(open)} value={value} onChange={change} theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              options={{ readOnly: locked, minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, padding: { top: 10 }, inlineSuggest: { enabled: true } }} />
          </div>
          {prompt && (
            <div className="absolute inset-x-6 top-12 z-20 rounded-xl border bg-popover p-3 shadow-xl">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wand2 className="size-3.5 text-dev" /> Edit {prompt.selection.split("\n").length} line{prompt.selection.split("\n").length > 1 ? "s" : ""} with AI</div>
              <form onSubmit={(e) => { e.preventDefault(); runEdit(); }} className="mt-2 flex gap-2">
                <input autoFocus value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setPrompt(null)}
                  placeholder="e.g. add error handling and a loading state" aria-label="Edit instruction" className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-dev/25" />
                <button type="submit" disabled={busy || !instruction.trim()} className="flex items-center gap-1.5 rounded-lg bg-dev px-3 text-sm font-medium text-white disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />}Generate</button>
              </form>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Esc to cancel · you&apos;ll review the diff before anything changes</p>
            </div>
          )}
        </div>
        <div className="overflow-y-auto border-t bg-[oklch(0.18_0.01_260)] p-3 font-mono text-[11px] leading-5 text-[oklch(0.85_0_0)]">
          {terminal.length ? terminal.map((l, i) => <div key={i} className={cn(l.includes("✗") && "text-red-300", l.includes("✓") && "text-emerald-300")}>{l}</div>) : <span className="opacity-50">$ _</span>}
          <div ref={termEnd} />
        </div>
      </div>
      <DiffReview edit={review} onClose={() => setReview(null)} onAccept={(e) => { persist(e.path, e.modified); toast.success("Change applied"); setReview(null); }} />
    </div>
  );
}
