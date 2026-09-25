import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { STARTING_CREDITS, balance, stageSpend } from "@/lib/usage";
import { timeAgo } from "@/components/projects/project-card";
import type { Project } from "@/lib/types";


export default async function UsagePage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  const projects = (data ?? []) as Project[];
  const { data: events } = await supabase.from("usage_events").select("id, kind, model, input_tokens, output_tokens, ms, cost_usd, created_at, projects(name)").order("created_at", { ascending: false }).limit(40);
  const ev = (events ?? []) as unknown as { id: string; kind: string; model: string; input_tokens: number; output_tokens: number; ms: number; cost_usd: number | null; created_at: string; projects: { name: string } | null }[];
  const realCost = ev.reduce((a, e) => a + Number(e.cost_usd ?? 0), 0);
  const realTokens = ev.reduce((a, e) => a + e.input_tokens + e.output_tokens, 0);
  const rows = projects.map((p) => {
    const parts = stageSpend(p);
    return { p, stages: parts.map((x) => x.stage), cost: parts.reduce((a, x) => a + x.cost, 0) };
  });
  const spent = rows.reduce((a, r) => a + r.cost, 0);
  const byStage = (["plan", "build", "test", "ship"] as const).map((s) => ({ s, v: projects.reduce((a, p) => a + (stageSpend(p).find((x) => x.stage === s)?.cost ?? 0), 0) }));
  const max = Math.max(0.01, ...byStage.map((b) => b.v));

  return (
    <>
      <PageHeader title="Usage & billing" description="Know what you spend, where, and why — before and after every build." actions={<Button>Top up credits</Button>} />
      <div className="grid gap-6 px-6 py-6 md:px-10 lg:grid-cols-3">
        <Stat label="Balance" value={`$${balance(projects).toFixed(2)}`} note={`Free plan · $${STARTING_CREDITS} on sign-up`} />
        <Stat label="Spent this month" value={`$${spent.toFixed(2)}`} note={`${projects.length} project${projects.length === 1 ? "" : "s"}`} />
        <Stat label="Self-fixes (free)" value={`${rows.filter((r) => r.stages.includes("build")).length}`} note="AI fixing its own errors is never billed" />

        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="text-sm font-medium">Spend by stage</div>
          <div className="mt-4 space-y-3">
            {byStage.map((b) => (
              <div key={b.s} className="text-xs">
                <div className="flex justify-between capitalize"><span>{b.s}</span><span className="tabular-nums">${b.v.toFixed(2)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand" style={{ width: `${(b.v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Budget cap: <b className="text-foreground">$5.00</b> per project. Builds pause and ask before going over.</div>
        </div>

        <div className="rounded-xl border bg-card lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div><div className="text-sm font-medium">Live AI usage</div><div className="text-xs text-muted-foreground">Every real model call, metered from the provider&apos;s token counts and list prices.</div></div>
            <div className="flex gap-4 text-xs"><span><b className="text-base tabular-nums">{realTokens.toLocaleString()}</b> tokens</span><span><b className="text-base tabular-nums">${realCost.toFixed(4)}</b> model cost</span></div>
          </div>
          {ev.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground"><tr><th className="p-3 font-normal">When</th><th className="font-normal">Project</th><th className="font-normal">What</th><th className="font-normal">Model</th><th className="font-normal">Tokens</th><th className="font-normal">Time</th><th className="p-3 text-right font-normal">Cost</th></tr></thead>
                <tbody>{ev.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 whitespace-nowrap">{timeAgo(e.created_at)}</td><td>{e.projects?.name ?? "—"}</td><td className="capitalize">{e.kind}</td><td className="font-mono">{e.model}</td>
                    <td className="tabular-nums">{(e.input_tokens + e.output_tokens).toLocaleString()}</td><td className="tabular-nums">{(e.ms / 1000).toFixed(1)}s</td>
                    <td className="p-3 text-right tabular-nums">{e.cost_usd === null ? "—" : `$${Number(e.cost_usd).toFixed(5)}`}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="p-6 text-sm text-muted-foreground">No AI calls recorded yet. Plans, screen designs, agent runs and tests will appear here.</p>}
        </div>

        <div className="rounded-xl border bg-card lg:col-span-2">
          <div className="border-b p-4 text-sm font-medium">Run receipts (credits)</div>
          {rows.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3 font-normal">Project</th><th className="p-3 font-normal">Stages</th><th className="p-3 text-right font-normal">Cost</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.p.id} className="border-t">
                    <td className="p-3 font-medium">{r.p.name}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{r.stages.join(" → ") || "—"}</td>
                    <td className="p-3 text-right tabular-nums">${r.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-6 text-sm text-muted-foreground">No runs yet. Every build will leave a receipt here.</p>}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
