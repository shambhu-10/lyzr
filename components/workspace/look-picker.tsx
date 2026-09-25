"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Palette } from "lucide-react";
import { toast } from "sonner";
import type { Plan } from "@/lib/types";
import { DEFAULT_THEME, type AppTheme } from "@/lib/theme";
import { AppThumb } from "@/components/app-preview/app-thumb";
import { Button } from "@/components/ui/button";
import { setTheme, suggestLooks } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";

const same = (a?: AppTheme, b?: AppTheme) => !!a && !!b && a.accent === b.accent && a.radius === b.radius && a.font === b.font && a.sidebar === b.sidebar;

/** "Pick a look": three AI-proposed visual directions rendered as real miniatures of the app. */
export function LookPicker({ projectId, plan, onPlan, onVersion, disabled }: { projectId: string; plan: Plan; onPlan: (p: Plan) => void; onVersion?: (v: unknown) => void; disabled?: boolean }) {
  const [loading, setLoading] = useState(!plan.looks?.length);
  const [saving, setSaving] = useState<string | null>(null);
  const looks = plan.looks ?? [];

  const load = async (fresh = false) => {
    setLoading(true);
    const r = await suggestLooks(projectId, fresh).catch(() => ({ error: "Couldn't suggest looks right now." }));
    setLoading(false);
    if ("error" in r) toast.error(r.error); else onPlan(r.plan);
  };
  // First visit: ask the AI for looks once (cached on the plan afterwards).
  // `loading` starts true when there are no looks yet, so the effect only needs the request.
  useEffect(() => {
    if (plan.looks?.length) return;
    suggestLooks(projectId).then((r) => { setLoading(false); if ("error" in r) toast.error(r.error); else onPlan(r.plan); }).catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (t: AppTheme) => {
    setSaving(t.name);
    onPlan({ ...plan, theme: t }); // optimistic
    const r = await setTheme(projectId, t).catch(() => ({ error: "Couldn't save the look." }));
    setSaving(null);
    if ("error" in r) { toast.error(r.error); onPlan(plan); } else { onPlan(r.plan); if (r.version) { onVersion?.(r.version); toast.success(`Look changed to ${t.name} — saved as a version`); } }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Palette className="size-4 text-brand" /> Pick a look</h3>
          <p className="mt-1 text-xs text-muted-foreground">Three directions designed for this app. You can switch anytime — even after it&apos;s live.</p>
        </div>
        <Button size="xs" variant="ghost" disabled={loading || disabled} onClick={() => load(true)}><RefreshCw className={cn(loading && "animate-spin")} /> New ideas</Button>
      </div>
      <div className="mt-3 grid gap-3 @lg:grid-cols-3">
        {loading && !looks.length
          ? [0, 1, 2].map((i) => <div key={i} className="aspect-[11/9] rounded-xl shimmer" />)
          : looks.map((t) => {
              const active = same(t, plan.theme ?? DEFAULT_THEME);
              return (
                <div key={t.name + t.accent} className={cn("group relative overflow-hidden rounded-xl border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] has-disabled:hover:translate-y-0", active && "border-brand ring-3 ring-brand/20")}>
                  {/* stretched button: the thumbnail contains the app's own buttons, which can't nest inside one */}
                  <button disabled={disabled || !!saving} onClick={() => pick(t)} aria-label={`Use the ${t.name} look`} aria-pressed={active} className="absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" />
                  <AppThumb plan={plan} theme={t} className="border-b" />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium">{t.name}
                      {saving === t.name ? <Loader2 className="size-3.5 animate-spin" /> : active && <span className="flex items-center gap-1 text-[11px] text-brand"><Check className="size-3" /> Selected</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.why}</p>
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
}
