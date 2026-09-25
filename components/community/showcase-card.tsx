import Link from "next/link";
import { Bot, Eye, GitFork, Plug } from "lucide-react";
import { AppThumb } from "@/components/app-preview/app-thumb";
import type { ShowcaseApp } from "@/lib/showcase";

/** A real app from the gallery: live miniature, who built it, what it's built with, and real counts. */
export function ShowcaseCard({ app }: { app: ShowcaseApp }) {
  const stack = [...app.plan.connections.map((c) => c.name), ...(app.plan.agents.length ? [`${app.plan.agents.length} agent${app.plan.agents.length > 1 ? "s" : ""}`] : [])];
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/live/${app.slug}`} target="_blank" className="block overflow-hidden border-b bg-muted/40 p-3 pb-0" aria-label={`Open ${app.name}`}>
        <AppThumb plan={app.plan} className="rounded-t-lg border border-b-0 shadow-sm transition duration-500 group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{app.name}</h3>
            <p className="line-clamp-2 text-sm text-muted-foreground">{app.tagline}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stack.slice(0, 3).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {s.includes("agent") ? <Bot className="size-3" /> : <Plug className="size-3" />}{s}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            {app.author && <><span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{app.author[0]}</span><span className="truncate">Built by <b className="font-medium text-foreground">{app.author}</b></span></>}
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="flex items-center gap-1" title="Views"><Eye className="size-3" />{app.views}</span>
            <span className="flex items-center gap-1" title="Remixes"><GitFork className="size-3" />{app.remixes}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href={`/live/${app.slug}`} target="_blank" className="rounded-lg border py-1.5 text-center text-xs font-medium hover:bg-muted">Try it</Link>
          <Link href={`/remix/${app.slug}`} className="flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-center text-xs font-medium text-primary-foreground hover:opacity-90"><GitFork className="size-3" />Remix</Link>
        </div>
      </div>
    </article>
  );
}
