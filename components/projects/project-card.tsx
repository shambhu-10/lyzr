import Link from "next/link";
import { Bot, FolderInput, LayoutTemplate } from "lucide-react";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppThumb } from "@/components/app-preview/app-thumb";

const STAGE_LABEL: Record<Project["stage"], string> = {
  plan: "Planning", connect: "Connecting tools", build: "Building", test: "Testing", ship: "Ready to ship", live: "Live",
};

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StageBadge({ stage }: { stage: Project["stage"] }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
      stage === "live" ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", stage === "live" ? "bg-brand" : "bg-muted-foreground/50")} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function ProjectCard({ p }: { p: Project }) {
  const Icon = p.kind === "agent" ? Bot : p.kind === "import" ? FolderInput : LayoutTemplate;
  return (
    <Link href={`/p/${p.id}`} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20 hover:shadow-[var(--shadow-lift)]">
      <div className="relative h-32 overflow-hidden border-b bg-[linear-gradient(135deg,var(--brand-soft),var(--muted))]">
        {p.plan?.screens.some((x) => x.blocks?.length) ? (
          <AppThumb plan={p.plan} className="absolute inset-x-3 top-3 rounded-t-md border shadow-sm transition duration-500 group-hover:-translate-y-1" />
        ) : (
          <div className="absolute inset-4 grid grid-cols-[1fr_3fr] gap-2 opacity-70">
            <div className="rounded bg-background/70" />
            <div className="space-y-2"><div className="h-3 w-2/3 rounded bg-background/80" /><div className="h-10 rounded bg-background/60" /></div>
          </div>
        )}
        {p.demo_data && <span className="absolute top-2 right-2 z-10 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-foreground">Demo data</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2 font-medium"><Icon className="size-4 text-muted-foreground" /><span className="truncate">{p.name}</span></div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{p.plan?.tagline ?? p.prompt}</p>
        <div className="mt-auto flex items-center justify-between pt-1"><StageBadge stage={p.stage} /><span className="text-[11px] text-muted-foreground">{timeAgo(p.updated_at)}</span></div>
      </div>
    </Link>
  );
}
