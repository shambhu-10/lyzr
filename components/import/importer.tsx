"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GithubIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { importRepo, listRepos, type Repo } from "@/lib/actions/import";
import { FRAMEWORKS } from "@/lib/catalog";
import { timeAgo } from "@/components/projects/project-card";
import { cn } from "@/lib/utils";

const SCAN = ["Cloning repository", "Detecting stack & framework", "Finding agents and tools", "Checking environment variables", "Mapping screens and routes"];

export function Importer() {
  const [repos, setRepos] = useState<Repo[] | null | undefined>(undefined);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [pick, setPick] = useState<Repo | null>(null);
  const [scan, setScan] = useState(-1);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listRepos().then(setRepos); }, []);

  const connect = async () => {
    const sb = createClient();
    const { error } = await sb.auth.linkIdentity({ provider: "github", options: { redirectTo: `${location.origin}/auth/callback?next=/import`, scopes: "read:user" } });
    if (error) {
      // Already-linked accounts just need a fresh token: re-auth with GitHub.
      await sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${location.origin}/auth/callback?next=/import`, scopes: "read:user" } });
    }
  };

  const analyze = async (r: Repo) => {
    setPick(r);
    for (let i = 0; i < SCAN.length; i++) { setScan(i); await new Promise((res) => setTimeout(res, 600)); }
    setScan(SCAN.length);
  };

  const fromUrl = () => {
    const m = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
    if (!m) return toast.error("Paste a GitHub URL like github.com/owner/repo");
    analyze({ full_name: `${m[1]}/${m[2]}`, name: m[2], description: null, language: null, updated_at: new Date().toISOString(), private: false, stargazers_count: 0 });
  };

  const framework = pick && /agent|crew|graph|llm|ai/i.test(pick.name + (pick.description ?? "")) ? (/crew/i.test(pick.name) ? "crewai" : "langgraph") : "lyzr";
  const list = (repos ?? []).filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()));

  if (pick)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 font-medium"><GithubIcon /> {pick.full_name}</div>
        <ul className="mt-5 space-y-2 text-sm">
          {SCAN.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2", i > scan && "text-muted-foreground/50")}>
              {i < scan ? <Check className="size-4 text-success" /> : i === scan ? <Loader2 className="size-4 animate-spin text-brand" /> : <span className="size-4 rounded-full border" />}{s}
            </li>
          ))}
        </ul>
        {scan >= SCAN.length && (
          <div className="rise mt-6 space-y-4">
            <div className="rounded-xl border bg-background p-4 text-sm">
              <div className="font-medium">Analysis report</div>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Language</dt><dd>{pick.language ?? "TypeScript"}</dd>
                <dt className="text-muted-foreground">Framework</dt><dd>Next.js (App Router)</dd>
                <dt className="text-muted-foreground">Agents found</dt><dd>1 · {FRAMEWORKS.find((f) => f.id === framework)?.label}</dd>
                <dt className="text-muted-foreground">Needs</dt><dd className="font-mono text-xs">OPENAI_API_KEY</dd>
                <dt className="text-muted-foreground">Your code</dt><dd>Kept as-is. Changes only happen when you ask, as commits on a branch.</dd>
              </dl>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setPick(null); setScan(-1); }}>Back</Button>
              <Button disabled={busy} onClick={async () => { setBusy(true); await importRepo(pick, framework); }}>{busy && <Loader2 className="animate-spin" />} Open in Architect</Button>
            </div>
          </div>
        )}
      </div>
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-3">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your repositories…" aria-label="Search repositories" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        {repos === undefined ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading your repositories…</div>
        ) : repos === null ? (
          <div className="flex flex-col items-center p-10 text-center">
            <GithubIcon className="size-7" />
            <p className="mt-3 font-medium">Connect GitHub to see your repositories</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Read-only access to list repos. We only clone the one you pick.</p>
            <Button className="mt-4" onClick={connect}>Connect GitHub</Button>
          </div>
        ) : (
          <ul className="max-h-[480px] divide-y overflow-y-auto">
            {list.map((r) => (
              <li key={r.full_name} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">{r.private && <Lock className="size-3" />}{r.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.language ?? "—"} · updated {timeAgo(r.updated_at)} · <Star className="inline size-3" /> {r.stargazers_count}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => analyze(r)}>Import</Button>
              </li>
            ))}
            {!list.length && <li className="p-6 text-sm text-muted-foreground">No repositories match.</li>}
          </ul>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm font-medium">Or paste a public URL</div>
          <div className="mt-3 flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="github.com/owner/repo" /><Button onClick={fromUrl}>Go</Button></div>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="font-medium">Also supported</div>
          <ul className="mt-2 space-y-1.5 text-muted-foreground"><li>• Zip upload</li><li>• Lovable, Bolt &amp; v0 exports</li><li>• Existing Lyzr Studio agents</li></ul>
        </div>
      </div>
    </div>
  );
}
