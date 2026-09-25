"use client";
import { useState } from "react";
import { ArrowUp, Bot, Loader2 } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";

export type WidgetTurn = { role: "user" | "assistant"; content: string };

/** The embeddable chat surface of an agent project — same UI in the workspace preview and on /live. */
export function ChatWidget({ name, tagline, suggestions, send, className }: {
  name: string; tagline: string; suggestions: string[]; send: (history: WidgetTurn[]) => Promise<string>; className?: string;
}) {
  const [turns, setTurns] = useState<WidgetTurn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (q: string) => {
    const next = [...turns, { role: "user" as const, content: q }];
    setTurns(next); setText(""); setBusy(true);
    try { setTurns([...next, { role: "assistant", content: await send(next) }]); }
    catch { setTurns([...next, { role: "assistant", content: "Sorry — I couldn't answer that right now. Please try again." }]); }
    setBusy(false);
  };
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-lift)]", className)}>
      <div className="flex items-center gap-2.5 border-b bg-primary px-4 py-3 text-primary-foreground">
        <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15"><Bot className="size-4" /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{name}</span><span className="block truncate text-[11px] opacity-70">{tagline}</span></span>
        <span className="ml-auto flex items-center gap-1 text-[10px] opacity-80"><span className="size-1.5 rounded-full bg-emerald-400" /> Online</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!turns.length && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Hi! Ask me anything about my job — try one of these:</p>
            <div className="flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border px-3 py-1 text-left text-xs hover:bg-muted">{s}</button>)}</div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-sm", t.role === "user" ? "ml-auto rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
            {t.role === "assistant" ? <RichText text={t.content} className="space-y-1 leading-relaxed" /> : t.content}
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) void ask(text.trim()); }} className="flex gap-2 border-t p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label={`Message ${name}`} className="h-9 min-w-0 flex-1 rounded-full border bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="size-4" /></button>
      </form>
    </div>
  );
}
