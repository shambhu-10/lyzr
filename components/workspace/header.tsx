"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Code2, Share2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { renameProject } from "@/lib/actions/projects";
import { ShareDialog } from "./share-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LensTip } from "@/components/lens-info";
import { STAGES, type Mode, type Project, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER: Stage[] = ["plan", "connect", "build", "test", "ship", "live"];

export function WorkspaceHeader({ project, mode, onMode, view, onView, credits, role }: {
  project: Project; mode: Mode; onMode: (m: Mode) => void; view: Stage; onView: (s: Stage) => void; credits: number; role: "owner" | "editor" | "viewer";
}) {
  const [draft, setName] = useState<string | null>(null);
  const name = draft ?? project.name; // follows the plan's name until the user edits it
  const [share, setShare] = useState(false);
  const [gh, setGh] = useState(false);
  const current = ORDER.indexOf(project.stage);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 sm:gap-3 sm:px-3">
      <Link href="/projects" className="flex items-center gap-1 rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Back to projects">
        <ChevronLeft className="size-4" /><LogoMark className="size-6" />
      </Link>
      <input value={name} onChange={(e) => setName(e.target.value)} readOnly={role === "viewer"} onBlur={() => name !== project.name && renameProject(project.id, name)}
        aria-label="Project name" className="w-24 truncate sm:w-36 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium outline-none hover:bg-muted focus:bg-muted lg:w-44" />
      {role !== "owner" && <span className="hidden rounded-md bg-dev-soft px-1.5 py-0.5 text-[11px] font-medium text-dev sm:inline">{role === "viewer" ? "View only" : "Shared with you"}</span>}

      <span className="mx-auto hidden text-xs text-muted-foreground md:inline lg:hidden">
        Step {Math.min(current + 1, 5)} of 5 · {project.stage === "live" ? "Live" : STAGES[current]?.label}
      </span>
      <nav className="mx-auto hidden items-center lg:flex" aria-label="Project stages">
        {STAGES.map((s, i) => {
          const done = i < current || project.stage === "live";
          const here = s.id === project.stage;
          const reachable = i <= current;
          return (
            <div key={s.id} className="flex items-center">
              {i > 0 && <span className={cn("mx-1 h-px w-3 xl:w-6", i <= current ? "bg-brand" : "bg-border")} />}
              <button disabled={!reachable} onClick={() => onView(s.id)} aria-current={here ? "step" : undefined}
                className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition",
                  view === s.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                  reachable && "hover:bg-muted", !reachable && "opacity-50")}>
                <span className={cn("grid size-4 place-items-center rounded-full border text-[9px]",
                  done ? "border-brand bg-brand text-brand-foreground" : here ? "border-brand text-brand" : "border-border")}>
                  {done ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="hidden xl:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <Tooltip><TooltipTrigger asChild>
        <label className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs", mode === "developer" ? "border-dev/30 bg-dev-soft text-dev" : "border-brand/30 bg-brand-soft text-brand")}>
          {mode === "developer" ? <Code2 className="size-3.5" /> : <Wand2 className="size-3.5" />}
          <span className="hidden font-medium sm:inline">{mode === "developer" ? "Developer" : "Builder"}</span>
          <Switch checked={mode === "developer"} onCheckedChange={(v) => onMode(v ? "developer" : "builder")} aria-label="Developer view" className="scale-75" />
        </label>
        </TooltipTrigger><TooltipContent side="bottom"><LensTip mode={mode === "developer" ? "builder" : "developer"} /></TooltipContent></Tooltip>
        <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">${credits.toFixed(2)}</span>
        <Button size="icon-sm" variant="ghost" onClick={() => setGh(true)} aria-label="GitHub" className="hidden sm:inline-flex"><GithubIcon /></Button>
        <Button size="sm" variant="outline" onClick={() => setShare(true)}><Share2 /> <span className="hidden sm:inline">Share</span></Button>
      </div>

      <ShareDialog project={project} name={name} open={share} onOpenChange={setShare} isOwner={role === "owner"} />

      <Dialog open={gh} onOpenChange={setGh}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GithubIcon /> GitHub</DialogTitle>
            <DialogDescription>{mode === "developer" ? "Two-way sync: every build is a commit, every chat session can be a branch." : "Keep a backup of your app's code in your own GitHub account."}</DialogDescription>
          </DialogHeader>
          {mode === "developer" ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-muted-foreground">Repository</span><Input defaultValue={`${project.slug.replace(/-[a-z0-9]{4}$/, "")}`} className="font-mono text-xs" />
                <span className="text-muted-foreground">Branch</span><Input defaultValue="architect/session-1" className="font-mono text-xs" />
              </div>
              <label className="flex items-center justify-between rounded-lg border p-2.5"><span>Open a pull request on each build</span><Switch defaultChecked /></label>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { toast.success("Pushed 12 files to architect/session-1"); setGh(false); }}>Push now</Button><Button onClick={() => { toast.success("Pull request #1 opened"); setGh(false); }}>Open PR</Button></div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between rounded-lg border p-3"><span><span className="block font-medium">Back up to GitHub</span><span className="text-xs text-muted-foreground">Saves every version automatically. You own the code.</span></span><Switch onCheckedChange={(v) => v && toast.success("Backups on — repo created in your GitHub")} /></label>
              <p className="text-xs text-muted-foreground">Connect GitHub in Settings if you haven&apos;t yet. Developers on your team can pick it up from there.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
