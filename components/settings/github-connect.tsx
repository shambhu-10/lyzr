"use client";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/icons";

export function GithubConnect({ connected, login }: { connected: boolean; login?: string }) {
  const connect = async () => {
    const { error } = await createClient().auth.linkIdentity({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback?next=/settings?s=github`, scopes: "read:user" },
    });
    if (error) toast.error(error.message);
  };
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
