"use client";
import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { INTEGRATIONS, type Integration } from "@/lib/integrations";
import { setWorkspaceConnection } from "@/lib/actions/connections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConsentDialog } from "./consent-dialog";

export function ConnectionsBoard({ connected }: { connected: Record<string, string> }) {
  const [target, setTarget] = useState<Integration | null>(null);
  const [q, setQ] = useState("");
  const list = INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const on = list.filter((i) => connected[i.id]);
  const off = list.filter((i) => !connected[i.id]);

  const Row = ({ i }: { i: Integration }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: i.color }}>{i.name[0]}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{i.name}</div>
        <div className="truncate text-xs text-muted-foreground">{connected[i.id] ? `Connected · ${i.scopes[0]}` : i.cat}</div>
      </div>
      {connected[i.id] ? (
        <Button size="sm" variant="ghost" onClick={async () => { await setWorkspaceConnection(i.id, false); toast(`${i.name} disconnected`); }}>Disconnect</Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setTarget(i)}>Connect</Button>
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
  const [keys, setKeys] = useState([{ name: "OPENAI_API_KEY", tail: "x9Qa", used: "Briefly" }]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="h-fit rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium"><KeyRound className="size-4" /> Secrets vault</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus /> Add</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add a secret</DialogTitle><DialogDescription>API keys live here — never paste them into chat.</DialogDescription></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              // ponytail: prototype discards the value; production encrypts it server-side (e.g. Supabase Vault).
              setKeys((k) => [...k, { name: name.toUpperCase().replace(/\W/g, "_"), tail: value.slice(-4), used: "—" }]);
              setName(""); setValue(""); setOpen(false); toast.success("Secret saved to vault");
            }}>
              <Input required placeholder="NAME (e.g. STRIPE_SECRET_KEY)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input required type="password" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
              <p className="text-[11px] text-muted-foreground">Prototype: the value is not stored — only the name and last 4 characters are shown.</p>
              <div className="flex justify-end"><Button type="submit">Save secret</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Encrypted. Injected into your app at runtime as environment variables.</p>
      <div className="mt-4 space-y-2">
        {keys.map((k) => (
          <div key={k.name} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
            <span className="font-mono">{k.name}</span><span className="text-muted-foreground">••••{k.tail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
