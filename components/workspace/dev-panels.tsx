"use client";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteSecret, listSecrets, setSecret, type SecretRow } from "@/lib/actions/secrets";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectLogs, type UsageRow } from "@/lib/actions/logs";
import type { Plan, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENVS = ["development", "preview", "production"] as const;

/** Environments: set real secret values per environment. Encrypted on the server; the browser only sees •••• + last 4. */
export function EnvPanel({ project, plan }: { project: Project; plan: Plan | null }) {
  const [rows, setRows] = useState<SecretRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ name: string; env: string } | null>(null);
  const [value, setValue] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => listSecrets(project.id).then((r) => ("error" in r ? setError(r.error ?? null) : setRows(r.secrets)));
  useEffect(() => { refresh(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const required = plan?.connections.filter((c) => c.kind === "apikey").map((c) => c.id) ?? [];
  const names = [...new Set([...required, ...(rows ?? []).map((r) => r.name)])];
  const cell = (name: string, env: string) => rows?.find((r) => r.name === name && (r.env === env || r.env === "all"));

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    const r = await setSecret(project.id, edit.env, edit.name, value);
    setBusy(false);
    if ("error" in r) return toast.error(r.error);
    toast.success(`${r.secret.name} saved for ${edit.env === "all" ? "all environments" : edit.env}`);
    setEdit(null); setValue(""); refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h2 className="font-semibold">Environments</h2>
        <p className="text-sm text-muted-foreground">Set API keys and secrets per environment. Values are encrypted (AES-256-GCM) before they&apos;re stored and are never shown again — only the last 4 characters.</p>
      </div>
      {error && <p className="rounded-lg bg-warning-soft p-3 text-sm">{error}</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3 font-normal">Variable</th>{ENVS.map((e) => <th key={e} className="p-3 font-normal capitalize">{e}</th>)}<th /></tr></thead>
          <tbody>
            {rows === null && !error ? <tr><td colSpan={5} className="p-4"><Loader2 className="size-4 animate-spin" /></td></tr> : names.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-sm text-muted-foreground">No variables yet. Add one below.</td></tr>
            ) : names.map((n) => (
              <tr key={n} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs"><KeyRound className="mr-1.5 inline size-3.5 text-muted-foreground" />{n}{required.includes(n) && <span className="ml-1.5 rounded bg-muted px-1 font-sans text-[10px] text-muted-foreground">required</span>}</td>
                {ENVS.map((e) => {
                  const c = cell(n, e);
                  return (
                    <td key={e} className="p-3 text-xs">
                      <button onClick={() => { setEdit({ name: n, env: e }); setValue(""); }} className={cn("rounded px-1.5 py-0.5 font-mono hover:ring-2 hover:ring-dev/30", c ? "bg-success/10 text-success" : "bg-warning-soft text-foreground")}
                        title={c ? `Set ${new Date(c.updated_at).toLocaleString()} — click to replace` : "Click to set"}>
                        {c ? `••••${c.last4}${c.env === "all" ? " (all)" : ""}` : "set value"}
                      </button>
                    </td>
                  );
                })}
                <td className="p-3 text-right">
                  {rows?.some((r) => r.name === n) && <button aria-label={`Delete ${n}`} onClick={async () => { await Promise.all((rows ?? []).filter((r) => r.name === n).map((r) => deleteSecret(r.id))); toast(`${n} deleted`); refresh(); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { setEdit({ name: newName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"), env: "all" }); setNewName(""); } }}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="NEW_VARIABLE" className="font-mono text-xs" aria-label="New variable name" />
        <Button type="submit" variant="outline"><Plus /> Add</Button>
      </form>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-mono text-base">{edit?.name}</DialogTitle><DialogDescription>Encrypted before saving. You won&apos;t be able to view it again — only replace it.</DialogDescription></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <select value={edit?.env} onChange={(e) => edit && setEdit({ ...edit, env: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-sm" aria-label="Environment">
              <option value="all">All environments</option>{ENVS.map((e) => <option key={e} value={e} className="capitalize">{e}</option>)}
            </select>
            <Input type="password" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste the value" autoComplete="off" aria-label="Secret value" />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy || !value}>{busy && <Loader2 className="animate-spin" />} Save securely</Button></div>
          </form>
        </DialogContent>
      </Dialog>
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
