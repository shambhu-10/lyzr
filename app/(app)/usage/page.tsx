import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { STARTING_CREDITS, balance, spentOn } from "@/lib/usage";
import { mySpend } from "@/lib/usage-log";
import { timeAgo } from "@/components/projects/project-card";

export default async function UsagePage() {
  const { supabase, profile } = await requireUser();
  const [spend, { data: events }, { data: projects }] = await Promise.all([
    mySpend(supabase), // metered ledger, grouped by project and kind
    supabase.from("usage_events").select("id, kind, model, input_tokens, output_tokens, ms, cost_usd, created_at, projects(name)").order("created_at", { ascending: false }).limit(40),
    supabase.from("projects").select("id, name"),
  ]);
  const ev = (events ?? []) as unknown as { id: string; kind: string; model: string; input_tokens: number; output_tokens: number; ms: number; cost_usd: number | null; created_at: string; projects: { name: string } | null }[];
  const spent = spentOn(spend);
  const calls = spend.reduce((a, r) => a + r.calls, 0);
  const realTokens = ev.reduce((a, e) => a + e.input_tokens + e.output_tokens, 0);
  const kinds = [...new Set(spend.map((r) => r.kind))];
  const byKind = kinds.map((k) => ({ s: k, v: spend.filter((r) => r.kind === k).reduce((a, r) => a + r.cost, 0) })).sort((a, b) => b.v - a.v);
  const max = Math.max(0.0001, ...byKind.map((b) => b.v));
  const names = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  const rows = [...new Set(spend.map((r) => r.project_id))].map((id) => ({ id, name: id ? names.get(id) ?? "Deleted project" : "Not tied to a project", cost: spentOn(spend, id ?? undefined), calls: spend.filter((r) => r.project_id === id).reduce((a, r) => a + r.calls, 0) })).sort((a, b) => b.cost - a.cost);

  return (
    <>
      <PageHeader title="Usage & billing" description="Know what you spend, where, and why — before and after every build." actions={<Button>Top up credits</Button>} />
      <div className="grid gap-6 px-6 py-6 md:px-10 lg:grid-cols-3">
        <Stat label="Balance" value={`$${balance(spent, profile?.bonus_credits).toFixed(2)}`} note={`Free plan · $${STARTING_CREDITS} on sign-up${Number(profile?.bonus_credits) ? ` + $${Number(profile?.bonus_credits).toFixed(0)} bonus` : ""}`} />
        <Stat label="Spent so far" value={`$${spent.toFixed(spent < 1 ? 4 : 2)}`} note="Metered from every model call and sandbox minute" />
        <Stat label="Metered calls" value={calls.toLocaleString()} note={`${rows.length} project${rows.length === 1 ? "" : "s"}`} />

        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="text-sm font-medium">Spend by kind</div>
          <div className="mt-4 space-y-3">
            {byKind.map((b) => (
              <div key={b.s} className="text-xs">
                <div className="flex justify-between capitalize"><span>{b.s}</span><span className="tabular-nums">${b.v.toFixed(4)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-brand" style={{ width: `${(b.v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {!byKind.length && <p className="text-xs text-muted-foreground">Nothing spent yet.</p>}
          <div className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Credits stop at $0: the server checks your balance before builds, changes and agent runs.</div>
        </div>

        <div className="rounded-xl border bg-card lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <div><div className="text-sm font-medium">Live AI usage</div><div className="text-xs text-muted-foreground">Every real model call, metered from the provider&apos;s token counts and list prices.</div></div>
            <div className="flex gap-4 text-xs"><span><b className="text-base tabular-nums">{realTokens.toLocaleString()}</b> tokens</span><span><b className="text-base tabular-nums">${ev.reduce((a, e) => a + Number(e.cost_usd ?? 0), 0).toFixed(4)}</b> cost (last 40)</span></div>
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
          <div className="border-b p-4 text-sm font-medium">Receipts by project</div>
          {rows.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3 font-normal">Project</th><th className="p-3 font-normal">Metered calls</th><th className="p-3 text-right font-normal">Cost</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id ?? "none"} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-xs text-muted-foreground tabular-nums">{r.calls}</td>
                    <td className="p-3 text-right tabular-nums">${r.cost.toFixed(4)}</td>
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
