"use client";
import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/types";
import type { AppTheme } from "@/lib/theme";
import { AppPreview } from "./app-preview";
import { cn } from "@/lib/utils";

const W = 1100, H = 700; // rendered at desktop size, then scaled to fit — a real screenshot, not a drawing

/** Live, non-interactive miniature of a generated app's first screen. */
export function AppThumb({ plan, theme, className }: { plan: Plan; theme?: AppTheme; className?: string }) {
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
