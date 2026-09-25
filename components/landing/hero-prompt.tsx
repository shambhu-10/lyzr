"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { savePendingPrompt } from "@/lib/pending-prompt";

const IDEAS = [
  "A meeting assistant that preps briefs from my calendar",
  "A support inbox that triages tickets with an AI agent",
  "A LangGraph research agent with a clean chat UI",
];

export function HeroPrompt() {
  const [value, setValue] = useState("");
  const router = useRouter();
  const go = (p = value) => {
    if (p.trim()) savePendingPrompt(p.trim());
    router.push("/login?next=/home");
  };
  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => { e.preventDefault(); go(); }}
        className="rounded-2xl border bg-card p-3 text-left shadow-[0_1px_0_rgba(0,0,0,.03),0_12px_40px_-12px_rgba(0,0,0,.15)] focus-within:ring-3 focus-within:ring-ring/30"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
          rows={3}
          placeholder="Describe the app or agent you want to build…"
          className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted-foreground"
          aria-label="Describe what you want to build"
        />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" /> Your idea is saved while you sign in
          </span>
          <button type="submit" aria-label="Start building" className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90">
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {IDEAS.map((i) => (
          <button key={i} onClick={() => go(i)} className="rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}
