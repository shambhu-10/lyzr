"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Braces, Database, Layers, Loader2, RefreshCw, Rows3, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { listAppData, seedExampleRows, type AppRow } from "@/lib/actions/app-data";
import { STACK, type Stack } from "@/lib/catalog";
import { schemaSql, type Column } from "@/lib/tech-spec";
import { cn } from "@/lib/utils";

type Table = { name: string; columns: Column[]; rows: AppRow[] };
const SOURCE = { seed: "example", app: "preview", live: "live" } as const;

/** The app's real data: tables (from the tech spec + anything a form saved) and the rows its forms have stored. */
export function DataPanel({ projectId, stack, built }: { projectId: string; stack: Stack; built: boolean }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<"rows" | "schema">("rows");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listAppData(projectId).catch(() => ({ error: "Couldn't load the data." }));
    setLoading(false);
    if ("error" in r) { setError(r.error ?? "Couldn't load the data."); return; }
    setError(null); setTables(r.tables);
    setActive((a) => a ?? r.tables[0]?.name ?? null);
  }, [projectId]);
  useEffect(() => { if (built) void load(); }, [built, load]); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on open

  const seed = async () => {
    setSeeding(true);
    const r = await seedExampleRows(projectId).catch(() => ({ error: "Couldn't add example rows." }));
    setSeeding(false);
    if ("error" in r) toast.error(r.error); else { toast.success(`Added ${r.added} example rows`); void load(); }
  };
  const table = tables?.find((t) => t.name === active) ?? null;
  const cols = useMemo(() => {
    if (!table) return [];
    const fromRows = table.rows.flatMap((r) => Object.keys(r.data));
    return [...new Set([...table.columns.map((c) => c.name), ...fromRows])];
  }, [table]);
  const rows = useMemo(() => {
    if (!table) return [];
    const s = q.trim().toLowerCase();
    return s ? table.rows.filter((r) => JSON.stringify(r.data).toLowerCase().includes(s)) : table.rows;
  }, [table, q]);
  const engine = STACK.database.find((d) => d.id === stack.database)?.label ?? "Postgres";

  if (!built) return <Empty text="Your app's database appears here after the build — with the rows your app saves." />;
  if (error) return <Empty text={error} />;
  if (!tables) return <div className="grid h-full min-h-80 place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!tables.length) return <Empty text="This app doesn't store anything — every run is fresh and private. Ask Architect to “save history” to add a database." />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand"><Database className="size-4" /></span>
          <div className="min-w-0"><div className="truncate font-mono text-sm font-semibold">app_{projectId.replace(/-/g, "").slice(0, 12)}</div><div className="text-xs text-muted-foreground">{engine}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground sm:inline">Read-only — editing coming soon</span>
          <button onClick={() => void load()} aria-label="Refresh data" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className={cn("size-3.5", loading && "animate-spin")} /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-48 shrink-0 overflow-y-auto border-r p-2">
          <div className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Tables</div>
          {tables.map((t) => (
            <button key={t.name} onClick={() => { setActive(t.name); setQ(""); }}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", t.name === active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60")}>
              <Layers className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate font-mono text-xs">{t.name}</span>
              <span className="rounded bg-background px-1.5 text-[10px] tabular-nums">{t.rows.length}</span>
            </button>
          ))}
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b p-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm"><Search className="size-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows…" aria-label="Search rows" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
            <div className="flex rounded-lg bg-muted p-0.5 text-xs">
              {([["rows", "Rows", Rows3], ["schema", "Schema", Braces]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-muted-foreground", view === v && "bg-background font-medium text-foreground shadow-sm")}><Icon className="size-3.5" />{label}</button>
              ))}
            </div>
            <span className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
          </div>
          {table && view === "rows" ? (
            rows.length ? (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-max text-xs">
                  <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr>
                    {["id", ...cols, "created_at", "source"].map((c) => <th key={c} className="border-b px-3 py-2 font-mono font-normal">{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.id.slice(0, 8)}</td>
                        {cols.map((c) => { const v = r.data[c]; const s = v === undefined || v === null ? "null" : String(v); return <td key={c} title={s} className={cn("max-w-64 truncate px-3 py-2 font-mono", s === "null" && "text-muted-foreground")}>{s}</td>; })}
                        <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground" suppressHydrationWarning>{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[10px]", r.source === "live" ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground")}>{SOURCE[r.source]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : q ? <Empty text={`No rows match “${q}”.`} /> : (
              <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted-foreground">
                <div className="max-w-sm space-y-3"><Database className="mx-auto size-6" /><p>No rows yet. Submit a form in your app (Preview or the live link) and it shows up here.</p>
                  {tables.every((t) => !t.rows.length) && <button disabled={seeding} onClick={seed} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-60">{seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Fill with example rows</button>}
                </div>
              </div>
            )
          ) : table ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground"><tr><th className="pb-2 font-normal">column</th><th className="pb-2 font-normal">type</th><th className="pb-2 font-normal">required</th></tr></thead>
                <tbody className="font-mono">
                  {[{ name: "id", type: "uuid", nullable: false }, { name: "owner_id", type: "uuid", nullable: false }, ...table.columns, { name: "created_at", type: "timestamptz", nullable: false }].map((c) => (
                    <tr key={c.name} className="border-t border-border/60"><td className="py-1.5">{c.name}</td><td className="py-1.5 text-dev">{c.type}</td><td className="py-1.5 text-muted-foreground">{c.nullable ? "—" : "yes"}</td></tr>
                  ))}
                </tbody>
              </table>
              {table.columns.length > 0 && <pre className="overflow-x-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-4 font-mono text-[11px] leading-5 text-[oklch(0.9_0_0)]">{schemaSql({ tables: [{ name: table.name, purpose: table.name, access: "owner", columns: table.columns }], routes: [], env: [], notes: [] }, stack.database)}</pre>}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid h-full min-h-80 place-items-center p-10 text-center text-sm text-muted-foreground"><div className="max-w-sm"><Database className="mx-auto mb-3 size-6" />{text}</div></div>;
}
