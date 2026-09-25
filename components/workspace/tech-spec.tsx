"use client";
import { useEffect, useMemo, useState } from "react";
import { Copy, Database, FileCode2, Folder, KeyRound, Layers, Lock, Plus, RefreshCw, Route, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Editable } from "./editable";
import { suggestTech } from "@/lib/actions/workspace";
import { FRAMEWORKS, MODELS, STACK, type Stack } from "@/lib/catalog";
import { ACCESS, COLUMN_TYPES, schemaSql, type Table, type TechSpec as Spec } from "@/lib/tech-spec";
import { filesFor, techFor } from "@/lib/script/files";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCESS_LABEL = { owner: "Only its creator", team: "Signed-in users read", public_read: "Anyone can read" } as const;

/** Developer view of the plan: stack, data model (→ SQL), file structure, API routes and env. */
export function TechSpecView({ projectId, plan, stack, framework, canEdit, onPlan, onSave, onStack }: {
  projectId: string; plan: Plan; stack: Stack; framework: string; canEdit: boolean;
  onPlan: (p: Plan) => void; onSave: (p: Plan) => Promise<void>; onStack: (s: Stack, framework: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(!plan.tech);
  const tech = techFor(plan, stack);
  const sql = useMemo(() => schemaSql(tech, stack.database), [tech, stack.database]);
  const tree = useMemo(() => filesFor(plan, framework, stack).map((f) => f.path).sort(), [plan, framework, stack]);

  const load = async (fresh: boolean) => {
    setLoading(true);
    const r = await suggestTech(projectId, fresh).catch(() => ({ error: "Couldn't write the spec right now." }));
    setLoading(false);
    if ("error" in r) toast.error(r.error as string); else onPlan(r.plan);
  };
  useEffect(() => {
    if (plan.tech) return;
    suggestTech(projectId).then((r) => { setLoading(false); if ("plan" in r && r.plan) onPlan(r.plan); }).catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- first visit only; cached on the plan afterwards

  const setTech = (next: Spec) => onSave({ ...plan, tech: next });
  const setTable = (i: number, patch: Partial<Table>) => setTech({ ...tech, tables: tech.tables.map((t, k) => (k === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-8">
      <section>
        <Head icon={<Layers />} title="Stack" hint={canEdit ? "Changing it rewrites the generated code — nothing is built yet." : undefined}
          action={!canEdit && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" /> locked after build</span>} />
        <div className="mt-3 grid gap-2 @lg:grid-cols-3">
          {plan.trigger ? null : <>
            <Choice label="Frontend" value={stack.frontend} options={STACK.frontend} disabled={!canEdit} onChange={(v) => onStack({ ...stack, frontend: v }, framework)} />
            <Choice label="Database" value={stack.database} options={STACK.database} disabled={!canEdit} onChange={(v) => onStack({ ...stack, database: v }, framework)} />
            <Choice label="Auth" value={stack.auth} options={STACK.auth} disabled={!canEdit} onChange={(v) => onStack({ ...stack, auth: v }, framework)} />
          </>}
          <Choice label="Agent framework" value={framework} options={FRAMEWORKS} disabled={!canEdit} onChange={(v) => onStack(stack, v)} />
          <Choice label="Model" value={stack.model} options={MODELS} disabled={!canEdit} onChange={(v) => onStack({ ...stack, model: v }, framework)} />
        </div>
      </section>

      <section>
        <Head icon={<Database />} title="Data model" hint={stack.database === "supabase" ? "Every table gets row-level security from its access rule." : "Access rules are enforced in the API layer (no RLS on this database)."}
          action={<Button size="xs" variant="ghost" disabled={loading} onClick={() => load(true)}><RefreshCw className={cn(loading && "animate-spin")} /> Regenerate spec</Button>} />
        {loading && !plan.tech ? <div className="mt-3 grid gap-3 @lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 rounded-xl shimmer" />)}</div> : (
          <div className="mt-3 grid gap-3 @lg:grid-cols-2">
            {tech.tables.map((t, i) => (
              <div key={t.name + i} className="group rounded-xl border bg-card">
                <div className="flex items-start justify-between gap-2 border-b p-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold text-dev"><Editable label="table name" value={t.name} editable={canEdit} onChange={(v) => setTable(i, { name: v })} /></div>
                    <div className="text-xs text-muted-foreground"><Editable label="table purpose" value={t.purpose} editable={canEdit} onChange={(v) => setTable(i, { purpose: v })} /></div>
                  </div>
                  {canEdit && <button aria-label={`Remove table ${t.name}`} onClick={() => setTech({ ...tech, tables: tech.tables.filter((_, k) => k !== i) })} className="text-muted-foreground opacity-0 group-hover:opacity-100"><X className="size-3.5" /></button>}
                </div>
                <table className="w-full font-mono text-xs">
                  <tbody>
                    {[{ name: "id", type: "uuid", fixed: true }, { name: "owner_id", type: "uuid", fixed: true }].map((c) => <tr key={c.name} className="text-muted-foreground"><td className="px-3 py-1">{c.name}</td><td className="px-3 py-1">{c.type}</td><td /></tr>)}
                    {t.columns.map((c, j) => (
                      <tr key={c.name + j} className="group/row border-t border-border/50">
                        <td className="px-3 py-1"><Editable label="column name" value={c.name} editable={canEdit} onChange={(v) => setTable(i, { columns: t.columns.map((x, k) => (k === j ? { ...x, name: v } : x)) })} /></td>
                        <td className="px-3 py-1">
                          {canEdit ? <select aria-label={`Type of ${c.name}`} value={c.type} onChange={(e) => setTable(i, { columns: t.columns.map((x, k) => (k === j ? { ...x, type: e.target.value as typeof c.type } : x)) })} className="bg-transparent text-dev outline-none">{COLUMN_TYPES.map((ty) => <option key={ty}>{ty}</option>)}</select> : <span className="text-dev">{c.type}</span>}
                          {!c.nullable && <span className="ml-1 text-[10px] text-muted-foreground">required</span>}
                        </td>
                        <td className="w-6 pr-2 text-right">{canEdit && <button aria-label={`Remove column ${c.name}`} onClick={() => setTable(i, { columns: t.columns.filter((_, k) => k !== j) })} className="text-muted-foreground opacity-0 group-hover/row:opacity-100"><X className="size-3" /></button>}</td>
                      </tr>
                    ))}
                    <tr className="text-muted-foreground"><td className="px-3 py-1">created_at</td><td className="px-3 py-1">timestamptz</td><td /></tr>
                  </tbody>
                </table>
                <div className="flex items-center justify-between gap-2 border-t p-2 text-xs">
                  {canEdit ? <button onClick={() => setTable(i, { columns: [...t.columns, { name: `field_${t.columns.length + 1}`, type: "text", nullable: true, note: "" }] })} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Column</button> : <span />}
                  <select aria-label={`Who can read ${t.name}`} disabled={!canEdit} value={t.access} onChange={(e) => setTable(i, { access: e.target.value as Table["access"] })} className="rounded-md border bg-background px-1.5 py-0.5 disabled:opacity-70">
                    {ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {canEdit && <button onClick={() => setTech({ ...tech, tables: [...tech.tables, { name: `table_${tech.tables.length + 1}`, purpose: "What this stores", access: "owner", columns: [{ name: "title", type: "text", nullable: false, note: "" }] }] })}
              className="grid min-h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted/50"><span className="flex items-center gap-1"><Plus className="size-4" /> Add table</span></button>}
          </div>
        )}
      </section>

      <section>
        <Head icon={<FileCode2 />} title={stack.database === "sqlite" ? "db/schema.sql (SQLite)" : stack.database === "neon" ? "db/schema.sql (Neon Postgres)" : "supabase/migrations/0001_init.sql"}
          action={<Button size="xs" variant="ghost" onClick={() => { navigator.clipboard.writeText(sql); toast("SQL copied"); }}><Copy /> Copy</Button>} />
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-4 font-mono text-[11px] leading-5 text-[oklch(0.9_0_0)]">{sql}</pre>
      </section>

      <div className="grid gap-6 @lg:grid-cols-2">
        <section>
          <Head icon={<Folder />} title="File structure" hint={`${tree.length} files generated for this stack`} />
          <ul className="mt-3 max-h-80 overflow-auto rounded-xl border bg-card p-3 font-mono text-xs leading-6">
            {tree.map((p) => { const depth = p.split("/").length - 1; return <li key={p} style={{ paddingLeft: depth * 12 }} className="truncate"><span className="text-muted-foreground">{depth ? "└ " : ""}</span>{p.split("/").pop()}{depth > 0 && <span className="text-muted-foreground/60"> · {p.split("/").slice(0, -1).join("/")}/</span>}</li>; })}
          </ul>
        </section>
        <section className="space-y-6">
          <div>
            <Head icon={<Route />} title="API routes" />
            <ul className="mt-3 divide-y rounded-xl border bg-card text-xs">
              {(tech.routes.length ? tech.routes : [{ method: "POST" as const, path: "/api/agents/:agent", purpose: "Run an agent" }]).map((r) => (
                <li key={r.method + r.path} className="flex gap-2 p-2.5"><span className="w-12 shrink-0 font-mono font-semibold text-dev">{r.method}</span><span className="min-w-0 flex-1"><span className="block truncate font-mono">{r.path}</span><span className="text-muted-foreground">{r.purpose}</span></span></li>
              ))}
            </ul>
          </div>
          <div>
            <Head icon={<KeyRound />} title="Environment" />
            <ul className="mt-3 divide-y rounded-xl border bg-card text-xs">
              {tech.env.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-2 p-2.5"><span className="truncate font-mono">{e.name}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px]", e.provided ? "bg-brand-soft text-brand" : "bg-warning-soft")}>{e.provided ? "Provisioned by Architect" : "You provide · Env tab"}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      {tech.notes.length > 0 && (
        <section><Head icon={<Layers />} title="Engineering notes" /><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{tech.notes.map((n) => <li key={n}>{n}</li>)}</ul></section>
      )}
    </div>
  );
}

function Head({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h3 className="flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-dev">{icon}{title}</h3>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
      {action}
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 rounded-xl border bg-card p-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className="bg-transparent text-sm font-medium outline-none disabled:opacity-80">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
