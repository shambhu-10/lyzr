"use client";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectLogs, type UsageRow } from "@/lib/actions/logs";
import type { Plan, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENVS = ["development", "preview", "production"] as const;

/** Environments: which variables each environment has. Names only — values live in the vault. */
export function EnvPanel({ project, plan }: { project: Project; plan: Plan | null }) {
  const base = ["ARCHITECT_AGENT_URL", "ARCHITECT_AGENT_TOKEN", ...(plan?.connections.filter((c) => c.kind === "apikey").map((c) => c.id) ?? [])];
  const [extra, setExtra] = useState<string[]>([]);
  const [name, setName] = useState("");
  const vars = [...base, ...extra];
  const connected = (v: string) => v.startsWith("ARCHITECT_") || project.connections[v] === "connected";
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h2 className="font-semibold">Environments</h2>
        <p className="text-sm text-muted-foreground">Each environment gets its own secrets. Values are encrypted in the vault and injected at runtime — never shown here.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3 font-normal">Variable</th>{ENVS.map((e) => <th key={e} className="p-3 font-normal capitalize">{e}</th>)}</tr></thead>
          <tbody>
            {vars.map((v) => (
              <tr key={v} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs"><KeyRound className="mr-1.5 inline size-3.5 text-muted-foreground" />{v}</td>
                {ENVS.map((e) => {
                  const set = connected(v) && (e !== "production" || project.stage === "live" || v.startsWith("ARCHITECT_"));
                  return <td key={e} className="p-3 text-xs"><span className={cn("rounded px-1.5 py-0.5", set ? "bg-success/10 text-success" : "bg-warning-soft")}>{set ? "••••••  set" : "missing"}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; setExtra((x) => [...x, name.toUpperCase().replace(/\W/g, "_")]); setName(""); toast.success("Variable added — set its value per environment in the vault"); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="NEW_VARIABLE" className="font-mono text-xs" aria-label="New variable name" />
        <Button type="submit" variant="outline"><Plus /> Add</Button>
      </form>
      <p className="text-xs text-muted-foreground">Prototype: variable names are kept for this session; values are never stored by this demo.</p>
    </div>
  );
}

/** Logs: real AI calls made for this project (from usage_events) — kind, model, tokens, latency, cost. */
export function LogsPanel({ projectId, terminal }: { projectId: string; terminal: string[] }) {
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const fetchRows = () => projectLogs(projectId).then(setRows).catch(() => setRows([]));
  useEffect(() => { fetchRows(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => { setRows(null); fetchRows(); };
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold">Logs</h2><p className="text-sm text-muted-foreground">Every real AI call this project made, plus the last build output.</p></div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw /> Refresh</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full font-mono text-xs">
          <thead className="border-b text-left text-muted-foreground"><tr><th className="p-2.5 font-normal">time</th><th className="font-normal">event</th><th className="font-normal">model</th><th className="font-normal">tokens in/out</th><th className="font-normal">latency</th><th className="pr-3 text-right font-normal">cost</th></tr></thead>
          <tbody>
            {rows === null ? <tr><td colSpan={6} className="p-4"><Loader2 className="size-4 animate-spin" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-muted-foreground">No AI calls logged yet.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2.5" suppressHydrationWarning>{new Date(r.created_at).toLocaleTimeString()}</td><td>{r.kind}</td><td>{r.model}</td>
                  <td>{r.input_tokens} / {r.output_tokens}</td><td>{r.ms}ms</td><td className="pr-3 text-right">{r.cost_usd === null ? "—" : `$${Number(r.cost_usd).toFixed(5)}`}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {terminal.length > 0 && <pre className="overflow-x-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-4 font-mono text-[11px] leading-5 text-[oklch(0.85_0_0)]">{terminal.join("\n")}</pre>}
    </div>
  );
}
