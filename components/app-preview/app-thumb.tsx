"use client";
import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/types";
import type { AppTheme } from "@/lib/theme";
import { AppPreview } from "./app-preview";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

const W = 1100, H = 700; // rendered at desktop size, then scaled to fit — a real screenshot, not a drawing

/** Live, non-interactive miniature of a generated app's first screen. */
export function AppThumb({ plan, theme, className }: { plan: Plan; theme?: AppTheme; className?: string }) {
  if (plan.trigger) return <AgentThumb plan={plan} className={className} />;
  return <ScreenThumb plan={plan} theme={theme} className={className} />;
}

/** Agent projects have no screens: show the chat they answer in, with a real test case as the example. */
function AgentThumb({ plan, className }: { plan: Plan; className?: string }) {
  const q = plan.tests?.[0]?.input ?? "What can you do?";
  return (
    <div aria-hidden className={cn("relative flex aspect-[11/7] flex-col overflow-hidden bg-card text-left select-none", className)}>
      <div className="flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground"><span className="grid size-5 place-items-center rounded-full bg-primary-foreground/15"><Bot className="size-3" /></span><span className="truncate text-[11px] font-semibold">{plan.name}</span><span className="ml-auto rounded-full bg-primary-foreground/15 px-1.5 text-[9px] capitalize">{plan.trigger?.kind}</span></div>
      <div className="flex-1 space-y-1.5 p-3 text-[10px] leading-snug">
        <div className="ml-auto w-fit max-w-[80%] rounded-xl rounded-br-sm bg-primary px-2 py-1 text-primary-foreground line-clamp-2">{q}</div>
        <div className="w-fit max-w-[85%] rounded-xl rounded-bl-sm bg-muted px-2 py-1 line-clamp-3">{plan.agents[0]?.role}</div>
      </div>
      <div className="flex flex-wrap gap-1 border-t px-3 py-1.5">{plan.agents.map((a) => <span key={a.name} className="rounded-full bg-brand-soft px-1.5 text-[9px] text-brand">{a.name}</span>)}</div>
    </div>
  );
}

function ScreenThumb({ plan, theme, className }: { plan: Plan; theme?: AppTheme; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none relative aspect-[11/7] overflow-hidden select-none", className)} inert>
      {scale > 0 && (
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute top-0 left-0 [&_.rise]:animate-none">
          <AppPreview plan={theme ? { ...plan, theme } : plan} revealed={plan.screens.length} demo={false} still />
        </div>
      )}
    </div>
  );
}
