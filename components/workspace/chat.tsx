"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Paperclip, Sparkles } from "lucide-react";
import type { Msg } from "@/lib/actions/workspace";
import type { Question } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import { VoiceButton } from "@/components/voice-button";


export function Chat({ messages, busy, busyLabel, placeholder, onSend, onAnswer, planToggle, onPlanToggle, children, context, onReviewEdit, readOnly }: {
  messages: Msg[]; busy: boolean; busyLabel: string; placeholder: string;
  onSend: (text: string) => void; onAnswer: (summary: string, from: Msg) => void;
  planToggle: boolean; onPlanToggle: (v: boolean) => void; children?: React.ReactNode;
  context?: string; onReviewEdit?: (edit: unknown) => void; readOnly?: string;
}) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy, children]);
  // A question card is open until the user replies after it.
  const lastUser = messages.reduce((i, m, k) => (m.role === "user" ? k : i), -1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.map((m, k) =>
          m.role === "user" ? (
            <div key={m.id} className="rise ml-8 rounded-2xl rounded-tr-sm bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap">
              {typeof m.meta?.file === "string" && <span className="mb-1 block font-mono text-[10px] text-dev">@{m.meta.file}</span>}{m.content}
            </div>
          ) : (
            <div key={m.id} className="rise flex gap-2.5">
              <LogoMark className="mt-0.5 size-6 shrink-0" />
              <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed">
                <RichText text={m.content} />
                {m.kind === "change" && Array.isArray(m.meta?.changes) && (m.meta.changes as string[]).length > 0 && (
                  <ul className="space-y-1 rounded-lg border bg-card p-2.5 text-xs">{(m.meta.changes as string[]).map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{c}</li>)}</ul>
                )}
                {m.kind === "questions" && k > lastUser && <QuestionCard questions={(m.meta?.questions as Question[]) ?? []} onSubmit={(a) => onAnswer(a, m)} disabled={busy} cta={m.meta?.forChange ? "Apply change" : "Write the plan"} />}
                {!!m.meta?.edit && <button onClick={() => onReviewEdit?.(m.meta?.edit)} className="flex items-center gap-1.5 rounded-lg border border-dev/30 bg-dev-soft px-2.5 py-1.5 text-xs font-medium text-dev hover:opacity-90">Review &amp; apply change to {(m.meta.edit as { path: string }).path}</button>}
                {m.meta?.live === false && <p className="text-[11px] text-muted-foreground">{m.meta?.failed ? "The AI didn't return a usable answer — please try again." : "Offline demo response — add a Groq API key for live AI."}</p>}
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
      {readOnly ? <p className="border-t p-3 text-center text-xs text-muted-foreground">{readOnly}</p> : <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) { onSend(text.trim()); setText(""); } }} className="border-t p-3">
        <div className="rounded-xl border bg-card p-2 focus-within:ring-3 focus-within:ring-ring/25">
          {context && <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">Context <span className="rounded bg-dev-soft px-1.5 py-0.5 font-mono text-dev">{context}</span> + project files</div>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={placeholder} aria-label="Message Architect"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            className="w-full resize-none bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Attach"><Paperclip className="size-3.5" /></button>
              <VoiceButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="When on, Architect updates the plan and asks before changing your app">
                <Switch checked={planToggle} onCheckedChange={onPlanToggle} className="scale-75" aria-label="Plan first" /> Plan first
              </label>
            </div>
            <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-3.5" /></button>
          </div>
        </div>
      </form>}
    </div>
  );
}

const OTHER = "__other__";

function QuestionCard({ questions, onSubmit, disabled, cta }: { questions: Question[]; onSubmit: (s: string) => void; disabled: boolean; cta: string }) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(questions.map((q) => [q.id, [q.options[0]?.label]])));
  const [other, setOther] = useState<Record<string, string>>({});
  const toggle = (q: Question, label: string) =>
    setPicked((p) => {
      const cur = p[q.id] ?? [];
      return { ...p, [q.id]: q.multi ? (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]) : [label] };
    });
  const answer = (q: Question) => (picked[q.id] ?? []).map((l) => (l === OTHER ? other[q.id]?.trim() : l.replace(/\s*\(recommended\)\s*/i, ""))).filter(Boolean).join(", ") || "no preference";
  const summary = () => questions.map((q) => `${q.text} → ${answer(q)}`).join("\n");
  const recommended = () => questions.map((q) => `${q.text} → ${q.options[0]?.label.replace(/\s*\(recommended\)\s*/i, "") ?? "no preference"}`).join("\n");

  return (
    <div className="space-y-4 rounded-xl border bg-card p-3">
      {questions.map((q) => (
        <fieldset key={q.id}>
          <legend className="text-sm font-medium">{q.text} {q.multi && <span className="text-xs font-normal text-muted-foreground">(pick any)</span>}</legend>
          {q.why && <p className="mt-0.5 mb-2 text-xs text-muted-foreground">Why I&apos;m asking: {q.why}</p>}
          <div className={cn("space-y-1.5", !q.why && "mt-2")}>
            {[...q.options, { label: OTHER, hint: "" }].map((o, i) => {
              const on = picked[q.id]?.includes(o.label);
              const isOther = o.label === OTHER;
              return (
                <div key={o.label}>
                  <button type="button" onClick={() => toggle(q, o.label)} aria-pressed={on}
                    className={cn("flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:border-foreground/25", on && "border-brand bg-brand-soft/60")}>
                    <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center border", q.multi ? "rounded" : "rounded-full", on ? "border-brand bg-brand text-brand-foreground" : "border-border")}>{on && <Check className="size-3" />}</span>
                    <span><span className="block text-sm">{isOther ? "Other…" : o.label.replace(/\s*\(recommended\)\s*/i, "")}{i === 0 && <span className="ml-1.5 text-[10px] text-brand">Recommended</span>}</span>{o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}</span>
                  </button>
                  {isOther && on && (
                    <input autoFocus value={other[q.id] ?? ""} onChange={(e) => setOther({ ...other, [q.id]: e.target.value })} placeholder="Type your answer" aria-label={`Your answer to: ${q.text}`}
                      className="mt-1.5 h-8 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <button disabled={disabled} onClick={() => onSubmit(summary())} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          <Sparkles className="size-4" /> {cta}
        </button>
        {questions.length > 1 && (
          <button disabled={disabled} onClick={() => onSubmit(recommended())} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Use all recommended</button>
        )}
      </div>
    </div>
  );
}
