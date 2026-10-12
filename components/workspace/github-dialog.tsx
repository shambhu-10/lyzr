"use client";
import { useEffect, useState } from "react";
import { ExternalLink, GitPullRequest, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { githubStatus, pushToGitHub, type GithubLink } from "@/lib/actions/github";
import { connectGitHub } from "@/lib/supabase/client";
import type { Mode, Project } from "@/lib/types";

type Status = Awaited<ReturnType<typeof githubStatus>>;

/** Real push: first time creates a private repo; later pushes add a commit (developers can push to a branch + PR). */
export function GithubDialog({ project, mode, open, onOpenChange }: { project: Project; mode: Mode; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState(project.slug.replace(/-[a-z0-9]{4}$/, ""));
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ commitUrl: string; pr: string | null; files: number; branch: string } | null>(null);

  useEffect(() => { if (open) githubStatus(project.id).then(setStatus).catch(() => setStatus({ connected: false, canPush: false, login: null, link: null })); }, [open, project.id]);

  const push = async () => {
    setBusy(true);
    const r = await pushToGitHub(project.id, { name, branch: mode === "developer" ? branch : "" }).catch(() => ({ error: "Couldn't reach GitHub." }));
    setBusy(false);
    if ("error" in r) return void toast.error(r.error);
    setStatus((s) => (s ? { ...s, link: r.link } : s));
    setLast(r);
    toast.success(r.pr ? "Pushed — pull request ready" : `Pushed ${r.files} files to ${r.branch}`);
  };
  const link: GithubLink | null = status?.link ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GithubIcon /> GitHub</DialogTitle>
          <DialogDescription>{mode === "developer" ? "Push the code as a commit. Push to a branch to open a pull request." : "Keep your app's code in your own GitHub account. You own it."}</DialogDescription>
        </DialogHeader>
        {!status ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Checking your GitHub connection…</p>
        : !status.canPush ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{status.connected ? `Connected as @${status.login}, but Architect can't create repos yet.` : "Connect GitHub so Architect can create a private repo and push your code."}</p>
            <Button onClick={() => connectGitHub(`/p/${project.id}`)}><GithubIcon /> {status.connected ? "Grant repo access" : "Connect GitHub"}</Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {link ? (
              <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50">
                <span className="min-w-0"><span className="block truncate font-mono text-xs">{link.repo}</span><span className="text-xs text-muted-foreground">{link.pushedAt ? `Last push ${new Date(link.pushedAt).toLocaleString()}` : "Not pushed yet"}</span></span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ) : (
              <label className="grid gap-1"><span className="text-muted-foreground">New private repo</span><Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono text-xs" aria-label="Repository name" /></label>
            )}
            {mode === "developer" && (
              <label className="grid gap-1"><span className="text-muted-foreground">Branch <span className="text-xs">(empty = {link?.branch ?? "main"}; another branch opens a PR)</span></span>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="architect/session-1" className="font-mono text-xs" aria-label="Branch" /></label>
            )}
            {last && (
              <div className="flex flex-wrap gap-3 text-xs">
                <a className="underline underline-offset-2" href={last.commitUrl} target="_blank" rel="noreferrer">View commit</a>
                {last.pr && <a className="flex items-center gap-1 underline underline-offset-2" href={last.pr} target="_blank" rel="noreferrer"><GitPullRequest className="size-3" /> Pull request</a>}
              </div>
            )}
            <div className="flex justify-end"><Button onClick={push} disabled={busy || (!link && !name.trim())}>{busy && <Loader2 className="animate-spin" />}{link ? "Push now" : "Create repo & push"}</Button></div>
            <p className="text-[11px] text-muted-foreground">Connected as @{status.login}. Each push is one commit; nothing is ever force-pushed.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
