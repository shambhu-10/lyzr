"use client";
import { useEffect, useState } from "react";
import { IntegrationIcon } from "@/components/integration-icon";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { deleteSecret, listSecrets, setSecret, type SecretRow } from "@/lib/actions/secrets";
import { toast } from "sonner";
import { INTEGRATIONS, type Integration } from "@/lib/integrations";
import { setWorkspaceConnection } from "@/lib/actions/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConsentDialog } from "./consent-dialog";
import { connectGoogleCalendar } from "./google-calendar";

export function ConnectionsBoard({ connected }: { connected: Record<string, string> }) {
  const [target, setTarget] = useState<Integration | null>(null);
  const [q, setQ] = useState("");
  const list = INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const on = list.filter((i) => connected[i.id]);
  const off = list.filter((i) => !connected[i.id]);

  const Row = ({ i }: { i: Integration }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <IntegrationIcon id={i.id} name={i.name} color={i.color} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{i.name}</div>
        <div className="truncate text-xs text-muted-foreground">{connected[i.id] ? `Connected · ${i.scopes[0]}` : i.id === "google-calendar" ? "Real Google sign-in · read-only" : i.cat}</div>
      </div>
      {connected[i.id] ? (
        <Button size="sm" variant="ghost" onClick={async () => { await setWorkspaceConnection(i.id, false); toast(`${i.name} disconnected`); }}>Disconnect</Button>
      ) : (
        <Button size="sm" variant="outline" onClick={async () => {
          if (i.id === "google-calendar") { const err = await connectGoogleCalendar("/connections"); if (err) toast.error(err); } else setTarget(i);
        }}>Connect</Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div>
        <Input placeholder="Search integrations…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 max-w-xs" aria-label="Search integrations" />
        <h2 className="mt-6 text-sm font-medium">Connected <span className="text-muted-foreground">({on.length})</span></h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{on.length ? on.map((i) => <Row key={i.id} i={i} />) : <p className="text-sm text-muted-foreground">Nothing connected yet. Connect once here, reuse in every project.</p>}</div>
        <h2 className="mt-8 text-sm font-medium">Available</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{off.map((i) => <Row key={i.id} i={i} />)}</div>
        <p className="mt-4 text-xs text-muted-foreground">Missing one? Any MCP server or REST API can be added as a custom tool from an agent&apos;s Tools tab.</p>
      </div>
      <SecretsVault />
      <ConsentDialog integration={target} open={!!target} onOpenChange={(o) => !o && setTarget(null)}
        onAllow={async () => { if (target) { await setWorkspaceConnection(target.id, true); toast.success(`${target.name} connected`); } }} />
    </div>
  );
}

function SecretsVault() {
  const [keys, setKeys] = useState<SecretRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const refresh = () => listSecrets(null).then((r) => ("error" in r ? setError(r.error ?? null) : setKeys(r.secrets)));
  useEffect(() => { refresh(); }, []);
  return (
    <div className="h-fit rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium"><KeyRound className="size-4" /> Secrets vault</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus /> Add</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add a secret</DialogTitle><DialogDescription>API keys live here — never paste them into chat. Available to every project in this workspace.</DialogDescription></DialogHeader>
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const r = await setSecret(null, "all", name, value);
              if ("error" in r) return toast.error(r.error);
              setName(""); setValue(""); setOpen(false); toast.success("Secret encrypted and saved"); refresh();
            }}>
              <Input required placeholder="NAME (e.g. STRIPE_SECRET_KEY)" value={name} onChange={(e) => setName(e.target.value)} className="font-mono" />
              <Input required type="password" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" aria-label="Secret value" />
              <p className="text-[11px] text-muted-foreground">Encrypted on the server (AES-256-GCM). You can replace it later but never view it again.</p>
              <div className="flex justify-end"><Button type="submit">Save secret</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Encrypted. Injected into your apps at runtime as environment variables.</p>
      {error && <p className="mt-3 rounded-md bg-warning-soft p-2 text-xs">{error}</p>}
      <div className="mt-4 space-y-2">
        {keys === null && !error ? <p className="text-xs text-muted-foreground">Loading…</p> : keys?.length === 0 ? <p className="text-xs text-muted-foreground">No secrets yet.</p> : keys?.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
            <span className="truncate font-mono">{k.name}</span>
            <span className="flex items-center gap-2 text-muted-foreground">••••{k.last4}
              <button aria-label={`Delete ${k.name}`} onClick={async () => { await deleteSecret(k.id); toast(`${k.name} deleted`); refresh(); }} className="hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
