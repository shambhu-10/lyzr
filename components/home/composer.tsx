"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowUp, Bot, FolderInput, LayoutTemplate, Loader2, Mic, Paperclip, SlidersHorizontal, X } from "lucide-react";
import { createProject } from "@/lib/actions/projects";
import { takePendingPrompt } from "@/lib/pending-prompt";
import { FRAMEWORKS, MODELS } from "@/lib/catalog";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "app" | "agent";

export function Composer({ mode, suggestions }: { mode: Mode; suggestions: string[] }) {
  const [kind, setKind] = useState<Kind>("app");
  const [prompt, setPrompt] = useState("");
  const [advanced, setAdvanced] = useState(mode === "developer");
  const [framework, setFramework] = useState("lyzr");
  const [model, setModel] = useState<string>(MODELS[0]);
  const [file, setFile] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const p = takePendingPrompt();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (external) after hydration
    if (p) setPrompt(p);
    areaRef.current?.focus();
  }, []);

  const dictate = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) return alert("Voice input isn't supported in this browser.");
    const r = new SR();
    r.lang = "en-US";
    r.onresult = (e) => setPrompt((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

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
            <label className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
              <span className="text-muted-foreground">Agent framework</span>
              <select value={framework} onChange={(e) => setFramework(e.target.value)} className="bg-transparent font-medium outline-none">
                {FRAMEWORKS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
              <span className="text-muted-foreground">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-transparent font-medium outline-none">
                {MODELS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <span className="flex items-center rounded-lg border bg-background px-2 py-1 text-xs text-muted-foreground">Stack: Next.js + Postgres</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
            <IconBtn label="Attach a file, screenshot or design" onClick={() => fileRef.current?.click()}><Paperclip className="size-4" /></IconBtn>
            <IconBtn label="Dictate" onClick={dictate} active={listening}><Mic className="size-4" /></IconBtn>
            <IconBtn label="Developer options" onClick={() => setAdvanced((a) => !a)} active={advanced}><SlidersHorizontal className="size-4" /></IconBtn>
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

type SpeechRecognitionLike = { lang: string; start: () => void; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void };

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
