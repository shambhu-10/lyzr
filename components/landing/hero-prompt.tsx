"use client";
import { useState } from "react";
import { useTypedPlaceholder } from "@/hooks/use-typed-placeholder";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { savePendingPrompt } from "@/lib/pending-prompt";


const EXAMPLES = [
  "A meeting assistant that preps a brief for every event on my calendar",
  "A support inbox that sorts tickets by urgency and drafts replies",
  "A LangGraph research agent that writes cited reports",
  "A lead scorer that reads new HubSpot deals and alerts the owner",
];
const STATIC = "Describe the app or agent you want to build…";

export function HeroPrompt() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const placeholder = useTypedPlaceholder(EXAMPLES, !value && !focused, STATIC);
  const router = useRouter();
  const go = () => {
    if (value.trim()) savePendingPrompt(value.trim());
    router.push("/login?next=/home");
  };
  return (
    <div className="mx-auto w-full max-w-xl">
      <form
        onSubmit={(e) => { e.preventDefault(); go(); }}
        className="rounded-2xl border bg-card p-3 text-left shadow-[0_1px_0_rgba(0,0,0,.03),0_12px_40px_-12px_rgba(0,0,0,.15)] focus-within:ring-3 focus-within:ring-ring/30"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
          rows={3}
          placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Describe what you want to build"
        />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" /> Your idea is saved while you sign in
          </span>
          <button type="submit" aria-label="Start building" className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90">
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
