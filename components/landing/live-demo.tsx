"use client";
import { useState } from "react";
import { Code2, Wand2 } from "lucide-react";
import { AppPreview } from "@/components/app-preview/app-preview";
import { fallbackBlocks, fallbackPlan } from "@/lib/ai/fallbacks";
import { estimate } from "@/lib/ai/estimate";
import { filesFor } from "@/lib/script/files";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

const base = fallbackPlan("meeting brief assistant");
const draft: Plan = { ...base, estimate: estimate(base) };
const DEMO: Plan = { ...draft, screens: draft.screens.map((s, i) => ({ ...s, blocks: fallbackBlocks(draft, i) })) };
const CODE = filesFor(DEMO, "langgraph");

/** The landing page shows the real renderer and the real generated code — not a screenshot. */
export function LiveDemo() {
  const [dev, setDev] = useState(false);
  const [file, setFile] = useState("agents/meeting_brief_agent.py");
  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-[0_24px_80px_-32px_rgba(0,0,0,.35)]">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-border" />)}</span>
        <span className="flex-1 truncate text-center font-mono text-xs text-muted-foreground">architect.app/p/briefly</span>
        <div className="flex rounded-full border p-0.5 text-xs">
          <button onClick={() => setDev(false)} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", !dev && "bg-brand-soft font-medium text-brand")}><Wand2 className="size-3" />Builder</button>
          <button onClick={() => setDev(true)} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", dev && "bg-dev-soft font-medium text-dev")}><Code2 className="size-3" />Developer</button>
        </div>
      </div>
      <div className="h-[520px]">
        {dev ? (
          <div className="grid h-full grid-cols-[180px_1fr] bg-[oklch(0.18_0.01_260)] text-[oklch(0.9_0_0)]">
            <aside className="overflow-y-auto border-r border-white/10 py-2 text-xs">
              {CODE.map((f) => <button key={f.path} onClick={() => setFile(f.path)} className={cn("block w-full truncate px-3 py-1 text-left hover:bg-white/5", file === f.path && "bg-white/10")}>{f.path}</button>)}
            </aside>
            <pre className="overflow-auto p-4 text-left font-mono text-[11.5px] leading-5">{CODE.find((f) => f.path === file)?.content}</pre>
          </div>
        ) : (
          <div className="h-full p-3"><AppPreview plan={DEMO} revealed={DEMO.screens.length} demo /></div>
        )}
      </div>
    </div>
  );
}
