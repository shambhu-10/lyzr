"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { FileCode2, FileText, Folder, Loader2, Lock } from "lucide-react";
import type { FileRow } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> });

const lang = (p: string) => (p.endsWith(".py") ? "python" : p.endsWith(".sql") ? "sql" : p.endsWith(".md") ? "markdown" : p.endsWith(".ts") || p.endsWith(".tsx") ? "typescript" : "plaintext");

export function CodePanel({ files, locked, terminal, onSave, writing }: {
  files: FileRow[]; locked: boolean; terminal: string[]; onSave: (path: string, content: string) => Promise<void>; writing?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [picked, setOpen] = useState<string>(files[0]?.path ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
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

  const change = (v?: string) => {
    if (locked || v === undefined) return;
    setDrafts((d) => ({ ...d, [open]: v }));
    setSaved("saving");
    clearTimeout(timer.current);
    const path = open;
    timer.current = setTimeout(async () => { await onSave(path, v); setSaved("saved"); }, 800);
  };

  if (!files.length)
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Files appear here as soon as the build starts writing them.</div>;

  return (
    <div className="grid h-full min-h-0 grid-cols-[200px_1fr] grid-rows-[1fr_150px] bg-background">
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
      <div className="flex min-h-0 flex-col">
        <div className="flex h-8 items-center justify-between border-b px-3 text-xs">
          <span className="font-mono">{open}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {locked ? <><Lock className="size-3" /> AI is writing — pause to edit</> : saved === "saving" ? "Saving…" : saved === "saved" ? "Saved ✓" : "Editable"}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <Monaco path={open}
            beforeMount={(m) => {
              // Generated files reference project modules Monaco can't see; keep syntax checks, drop false "cannot find module" errors.
              const ts = m.languages.typescript;
              ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
              ts.typescriptDefaults.setCompilerOptions({ jsx: ts.JsxEmit.Preserve, allowNonTsExtensions: true, target: ts.ScriptTarget.ESNext });
            }} language={lang(open)} value={value} onChange={change} theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            options={{ readOnly: locked, minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, padding: { top: 10 } }} />
        </div>
      </div>
      <div className="overflow-y-auto border-t bg-[oklch(0.18_0.01_260)] p-3 font-mono text-[11px] leading-5 text-[oklch(0.85_0_0)]">
        {terminal.length ? terminal.map((l, i) => <div key={i} className={cn(l.includes("✗") && "text-red-300", l.includes("✓") && "text-emerald-300")}>{l}</div>) : <span className="opacity-50">$ _</span>}
        <div ref={termEnd} />
      </div>
    </div>
  );
}
