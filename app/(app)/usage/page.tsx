import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { STARTING_CREDITS, balance, stageSpend } from "@/lib/usage";
import type { Project } from "@/lib/types";


export default async function UsagePage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  const projects = (data ?? []) as Project[];
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

        <div className="rounded-xl border bg-card lg:col-span-2">
          <div className="border-b p-4 text-sm font-medium">Run receipts</div>
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
