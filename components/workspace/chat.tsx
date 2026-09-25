"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Paperclip, Sparkles } from "lucide-react";
import type { Msg } from "@/lib/actions/workspace";
import type { Question } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Minimal **bold** rendering — enough for assistant messages without a markdown dependency. */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}

export function Chat({ messages, busy, busyLabel, placeholder, onSend, onAnswer, planToggle, onPlanToggle, children }: {
  messages: Msg[]; busy: boolean; busyLabel: string; placeholder: string;
  onSend: (text: string) => void; onAnswer: (summary: string) => void;
  planToggle: boolean; onPlanToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy, children]);
  const answered = messages.some((m) => m.kind === "answers");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="rise ml-8 rounded-2xl rounded-tr-sm bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap">{m.content}</div>
          ) : (
            <div key={m.id} className="rise flex gap-2.5">
              <LogoMark className="mt-0.5 size-6 shrink-0" />
              <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed">
                <p><Rich text={m.content} /></p>
                {m.kind === "questions" && !answered && <QuestionCard questions={(m.meta?.questions as Question[]) ?? []} onSubmit={onAnswer} disabled={busy} />}
                {m.meta?.live === false && <p className="text-[11px] text-muted-foreground">Offline demo response — add a Groq API key for live AI.</p>}
              </div>
            </div>
          ),
        )}
        {children}
        {busy && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <LogoMark className="size-6 shrink-0" /><Loader2 className="size-4 animate-spin text-brand" />{busyLabel}
          </div>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) { onSend(text.trim()); setText(""); } }} className="border-t p-3">
        <div className="rounded-xl border bg-card p-2 focus-within:ring-3 focus-within:ring-ring/25">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={placeholder} aria-label="Message Architect"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            className="w-full resize-none bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Attach"><Paperclip className="size-3.5" /></button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="When on, Architect updates the plan and asks before changing your app">
                <Switch checked={planToggle} onCheckedChange={onPlanToggle} className="scale-75" aria-label="Plan first" /> Plan first
              </label>
            </div>
            <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-3.5" /></button>
          </div>
        </div>
      </form>
    </div>
  );
}

function QuestionCard({ questions, onSubmit, disabled }: { questions: Question[]; onSubmit: (s: string) => void; disabled: boolean }) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(questions.map((q) => [q.id, [q.options[0]?.label]])));
  const toggle = (q: Question, label: string) =>
    setPicked((p) => {
      const cur = p[q.id] ?? [];
      return { ...p, [q.id]: q.multi ? (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]) : [label] };
    });
  const summary = () => questions.map((q) => `${q.text} → ${(picked[q.id] ?? []).join(", ") || "no preference"}`).join("\n");

  return (
    <div className="space-y-4 rounded-xl border bg-card p-3">
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="mb-2 text-sm font-medium">{q.text} {q.multi && <span className="text-xs font-normal text-muted-foreground">(pick any)</span>}</legend>
          <div className="space-y-1.5">
            {q.options.map((o, i) => {
              const on = picked[q.id]?.includes(o.label);
              return (
                <button type="button" key={o.label} onClick={() => toggle(q, o.label)} aria-pressed={on}
                  className={cn("flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:border-foreground/25", on && "border-brand bg-brand-soft/60")}>
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center border", q.multi ? "rounded" : "rounded-full", on ? "border-brand bg-brand text-brand-foreground" : "border-border")}>{on && <Check className="size-3" />}</span>
                  <span><span className="block text-sm">{o.label}{i === 0 && <span className="ml-1.5 text-[10px] text-brand">Recommended</span>}</span>{o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <button disabled={disabled} onClick={() => onSubmit(summary())} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Sparkles className="size-4" /> Write the plan
      </button>
    </div>
  );
}
