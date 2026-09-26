"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { UsePromptButton } from "@/components/explore/use-prompt-button";
import { TEMPLATES } from "@/lib/explore";
import { TemplateLibrary } from "@/components/explore/template-library";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Bottom panel on Home (Lovable-style): recent projects or templates, one tab at a time. */
export function HomeShelf({ projects, userId }: { projects: Project[]; userId: string }) {
  const [tab, setTab] = useState<"recent" | "templates">(projects.length ? "recent" : "templates");
  return (
    <section className="rounded-t-3xl border border-b-0 bg-card/80 px-4 pt-3 pb-10 shadow-[0_-12px_40px_-24px_rgb(0_0_0/.35)] backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-muted p-1 text-sm" role="tablist">
          {([["recent", "Recent projects"], ["templates", "Templates"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-lg px-3 py-1 text-muted-foreground transition", tab === id && "bg-background font-medium text-foreground shadow-sm")}>{label}</button>
          ))}
        </div>
        <Link href={tab === "recent" ? "/projects" : "/explore"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {tab === "recent" ? "All projects" : "Browse all"} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {tab === "recent" ? (
        projects.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{projects.map((p) => <ProjectCard key={p.id} p={p} owned={p.owner_id === userId} />)}</div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p>Your projects will show up here. New to Architect? Open a ready-made sample and click around — nothing to set up.</p>
            <UsePromptButton prompt={TEMPLATES[1].prompt} label="Try the sample project (Briefly)" variant="default" />
          </div>
        )
      ) : (
        <TemplateLibrary className="mt-4" />
      )}
    </section>
  );
}
