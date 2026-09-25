"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createAgent } from "@/lib/actions/agents";
import { FRAMEWORKS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function NewAgentButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild><Button><Plus /> New agent</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New agent</DialogTitle><DialogDescription>Agents live in your workspace and can be reused in any project.</DialogDescription></DialogHeader>
        <form className="space-y-3" action={async (f) => { setBusy(true); const id = await createAgent(f); router.push(`/agents/${id}`); }}>
          <Input name="name" required placeholder="Name, e.g. Lead Scorer" />
          <textarea name="role" required rows={3} placeholder="What's its job? e.g. Score new HubSpot leads against our ICP and explain why." className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
          <select name="framework" className="h-9 w-full rounded-lg border bg-background px-2 text-sm" aria-label="Framework">
            {FRAMEWORKS.map((f) => <option key={f.id} value={f.id}>{f.label} ({f.lang})</option>)}
          </select>
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create agent</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SOURCES = ["GitHub repo", "Lyzr Studio", "Upload code"] as const;

export function ImportAgentButton() {
  const router = useRouter();
  const [src, setSrc] = useState<(typeof SOURCES)[number]>("GitHub repo");
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "scan" | "found">("idle");
  const scan = async () => { setPhase("scan"); await new Promise((r) => setTimeout(r, 1600)); setPhase("found"); };
  const detected = /crew/i.test(url) ? "crewai" : /graph|lang/i.test(url) ? "langgraph" : /openai/i.test(url) ? "openai-agents" : "langgraph";
  return (
    <Dialog onOpenChange={(o) => !o && setPhase("idle")}>
      <DialogTrigger asChild><Button variant="outline"><Download /> Import agent</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Import an existing agent</DialogTitle><DialogDescription>Bring agents you already built — in any framework. Architect wraps them with the same run contract, traces and evals.</DialogDescription></DialogHeader>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {SOURCES.map((s) => <button key={s} onClick={() => setSrc(s)} className={cn("flex-1 rounded-md py-1 text-xs", src === s && "bg-background font-medium shadow-sm")}>{s}</button>)}
        </div>
        {src === "Upload code" ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Drop a .zip or a folder with your agent code</div>
        ) : (
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={src === "GitHub repo" ? "github.com/acme/research-agent" : "Lyzr Studio agent ID"} />
        )}
        {phase === "found" && (
          <div className="space-y-1.5 rounded-lg border bg-card p-3 text-sm">
            <div className="font-medium">Found 1 agent</div>
            <div className="text-xs text-muted-foreground">Framework: <b className="text-foreground">{FRAMEWORKS.find((f) => f.id === detected)?.label}</b> · Tools: web_search, fetch_url · Needs: <span className="font-mono">OPENAI_API_KEY</span></div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          {phase !== "found" ? (
            <Button onClick={scan} disabled={phase === "scan" || (src !== "Upload code" && !url)}>{phase === "scan" && <Loader2 className="animate-spin" />} {phase === "scan" ? "Analyzing…" : "Analyze"}</Button>
          ) : (
            <Button onClick={async () => {
              const f = new FormData(); f.set("name", "Research Agent"); f.set("role", "Plans search queries, reads sources and writes a cited report"); f.set("framework", detected);
              const id = await createAgent(f); toast.success("Agent imported"); router.push(`/agents/${id}`);
            }}>Import agent</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
