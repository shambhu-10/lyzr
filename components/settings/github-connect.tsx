"use client";
import { toast } from "sonner";
import { connectGitHub } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/icons";

export function GithubConnect({ connected, login }: { connected: boolean; login?: string }) {
  const connect = () => connectGitHub("/settings?s=github").catch(() => toast.error("Couldn't reach GitHub."));
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
      <GithubIcon className="size-6" />
      <div className="flex-1">
        <div className="font-medium">{connected ? `Connected${login ? ` as @${login}` : ""}` : "GitHub not connected"}</div>
        <div className="text-sm text-muted-foreground">Import repos, back up projects and open pull requests.</div>
      </div>
      {!connected && <Button onClick={connect}>Connect GitHub</Button>}
    </div>
  );
}
