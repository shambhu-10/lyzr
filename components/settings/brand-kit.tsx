"use client";
import { useState } from "react";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Architect Paper", c: ["#F7F6F2", "#1F2430", "#139C8E"] },
  { name: "Modern Minimal", c: ["#FFFFFF", "#0F172A", "#2563EB"] },
  { name: "Midnight Bloom", c: ["#14121F", "#F1EEFF", "#A78BFA"] },
  { name: "Claymorphism", c: ["#F4EFEA", "#3B2F2F", "#F97316"] },
  { name: "Editorial", c: ["#FFFDF8", "#111111", "#B91C1C"] },
  { name: "Forest", c: ["#F3F7F2", "#1B2E1F", "#15803D"] },
];

export function BrandKit() {
  const [active, setActive] = useState(PRESETS[0].name);
  return (
    <div>
      <p className="text-sm text-muted-foreground">New projects in this workspace use your brand kit. Each project can still override it.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => { setActive(p.name); toast.success(`${p.name} is now your workspace default`); }}
            className={cn("rounded-xl border bg-card p-3 text-left transition hover:border-foreground/25", active === p.name && "border-brand ring-3 ring-brand/15")}>
            <div className="flex h-16 overflow-hidden rounded-lg border">{p.c.map((c) => <div key={c} className="flex-1" style={{ background: c }} />)}</div>
            <div className="mt-2 flex items-center justify-between text-sm font-medium">{p.name}{active === p.name && <Check className="size-4 text-brand" />}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm">
        <Upload className="size-4 text-muted-foreground" />
        <span className="flex-1">Bring your own design system — import from Figma, a GitHub repo, a PDF brand guide or a zip.</span>
        <Button size="sm" variant="outline" onClick={() => toast("Import started — we'll extract colors, type and components.")}>Import</Button>
      </div>
    </div>
  );
}
