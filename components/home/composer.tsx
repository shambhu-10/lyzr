"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowUp, Bot, Code2, FolderInput, LayoutTemplate, Loader2, Paperclip, Wand2, X } from "lucide-react";
import { VoiceButton } from "@/components/voice-button";
import { createProject } from "@/lib/actions/projects";
import { takePendingPrompt } from "@/lib/pending-prompt";
import { DEFAULT_STACK, FRAMEWORKS, MODELS, STACK, type Stack } from "@/lib/catalog";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "app" | "agent";

export function Composer({ mode, suggestions }: { mode: Mode; suggestions: string[] }) {
  const [kind, setKind] = useState<Kind>("app");
  const [prompt, setPrompt] = useState("");
  const [lens, setLens] = useState<Mode>(mode);
  const [framework, setFramework] = useState("lyzr");
  const [stack, setStack] = useState<Stack>(DEFAULT_STACK);
  const set = <K extends keyof Stack>(k: K, v: Stack[K]) => setStack((s) => ({ ...s, [k]: v }));
  const advanced = lens === "developer";
  const [file, setFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const p = takePendingPrompt();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (external) after hydration
    if (p) setPrompt(p);
    areaRef.current?.focus();
  }, []);

  const placeholder = kind === "app" ? "Describe the app you want — who it's for and what it should do…" : "Describe the agent — its job, the tools it uses, and when it runs…";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="What are you building?">
        {([["app", "App", LayoutTemplate], ["agent", "Agent", Bot]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground", kind === k && "bg-card font-medium text-foreground shadow-sm ring-1 ring-border")}>
            <Icon className="size-4" />{label}
          </button>
        ))}
        <Link href="/import" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <FolderInput className="size-4" />Import
        </Link>
      </div>
      <form action={createProject} className="rounded-2xl border bg-card p-3 shadow-[0_12px_40px_-16px_rgba(0,0,0,.18)] focus-within:ring-3 focus-within:ring-ring/25">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="framework" value={framework} />
        <input type="hidden" name="lens" value={lens} />
        <input type="hidden" name="stack" value={JSON.stringify(stack)} />
        <textarea ref={areaRef} name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={placeholder} aria-label="Describe what to build"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (prompt.trim()) e.currentTarget.form?.requestSubmit(); } }}
          className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground" />
        {file && (
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs">
            <Paperclip className="size-3" />{file}<button type="button" onClick={() => setFile(null)} aria-label="Remove file"><X className="size-3" /></button>
          </span>
        )}
        {advanced && (
          <div className="mt-2 flex flex-wrap gap-2 px-1">
            {kind === "app" && <>
              <Pick label="Frontend" value={stack.frontend} onChange={(v) => set("frontend", v)} options={STACK.frontend} />
              <Pick label="Database" value={stack.database} onChange={(v) => set("database", v)} options={STACK.database} />
              <Pick label="Auth" value={stack.auth} onChange={(v) => set("auth", v)} options={STACK.auth} />
            </>}
            <Pick label="Agent framework" value={framework} onChange={setFramework} options={FRAMEWORKS} />
            <Pick label="Model" value={stack.model} onChange={(v) => set("model", v)} options={MODELS} />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
            <IconBtn label="Attach a file, screenshot or design" onClick={() => fileRef.current?.click()}><Paperclip className="size-4" /></IconBtn>
            <VoiceButton onText={(t) => setPrompt((p) => (p ? `${p} ${t}` : t))} className="h-8 px-2" />
            <div className="ml-1 flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="How Architect should talk to you">
              {([["builder", "Builder", Wand2], ["developer", "Developer", Code2]] as const).map(([m, label, Icon]) => (
                <button key={m} type="button" role="radio" aria-checked={lens === m} onClick={() => setLens(m)}
                  title={m === "developer" ? "Technical questions, stack choices and a full technical spec" : "Plain-language questions and plan"}
                  className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground", lens === m && (m === "developer" ? "bg-background font-medium text-dev shadow-sm" : "bg-background font-medium text-brand shadow-sm"))}>
                  <Icon className="size-3.5" /><span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <Submit disabled={!prompt.trim()} />
        </div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setPrompt(s); areaRef.current?.focus(); }}
            className="rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">{s}</button>
        ))}
      </div>
    </div>
  );
}

function Pick<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly { id: T; label: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="bg-transparent font-medium outline-none">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function IconBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-muted text-foreground")}>
      {children}
    </button>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-label="Start planning"
      className="flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />} Plan it
    </button>
  );
}
