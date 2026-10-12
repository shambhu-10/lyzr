"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RotateCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wakePreview } from "@/lib/actions/build";

/** The real app, running in its sandbox. Waking a paused sandbox takes a second or two. */
export function SandboxPreview({ projectId, working, onDesignView }: { projectId: string; working?: string | null; onDesignView: () => void }) {
  const [state, setState] = useState<{ url?: string; error?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const load = useCallback(() => wakePreview(projectId).then((r) => setState("error" in r ? { error: r.error } : { url: r.url })).catch(() => setState({ error: "Couldn't reach the sandbox." })), [projectId]);
  useEffect(() => { void load(); }, [load]); // state starts as "waking"; it's set when the sandbox answers
  const wake = () => { setState(null); void load(); };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-background px-3 py-1.5 text-xs text-muted-foreground">
        <Server className="size-3.5 text-success" />
        <span className="min-w-0 flex-1 truncate">{working ? <span className="flex items-center gap-1.5 text-foreground"><Loader2 className="size-3 animate-spin" /> {working}…</span> : <>Running in a Vercel Sandbox (microVM){state?.url ? ` · ${state.url.replace(/^https:\/\//, "")}` : ""}</>}</span>
        <Button size="xs" variant="ghost" onClick={onDesignView}>Design view</Button>
        <Button size="icon-xs" variant="ghost" aria-label="Reload the app" onClick={() => setNonce((n) => n + 1)} disabled={!state?.url}><RotateCw /></Button>
        {state?.url && <Button size="icon-xs" variant="ghost" asChild aria-label="Open the running app"><a href={state.url} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>}
      </div>
      {state?.url ? <iframe key={nonce} src={state.url} title="Your running app" className="min-h-0 flex-1 bg-white" />
        : state?.error ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground"><div className="space-y-3"><p>{state.error}</p><Button size="sm" variant="outline" onClick={wake}>Try again</Button></div></div>
        : <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Waking your app&apos;s sandbox…</span></div>}
    </div>
  );
}
