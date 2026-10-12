import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usage } from "@/lib/ai/gateway";
import { balance, spentOn, type Spend } from "@/lib/usage";

/** Record real usage (tokens, latency, list-price cost) — the ledger credits are computed from. */
export async function logUsage(supabase: SupabaseClient, projectId: string | null, kind: string, usage: (Usage | null | undefined)[]) {
  const rows = usage.filter((u): u is Usage => !!u).map((u) => ({ project_id: projectId, kind, ...u }));
  if (rows.length) {
    const { error } = await supabase.from("usage_events").insert(rows);
    if (error) console.error("usage log failed", error.message); // never block the user on bookkeeping
  }
}

/** The signed-in user's spend, grouped by project and kind (migration 0006's my_spend()). */
export async function mySpend(supabase: SupabaseClient): Promise<Spend[]> {
  const { data, error } = await supabase.rpc("my_spend");
  if (error) { console.error("my_spend failed — is migration 0006 applied?", error.message); return []; }
  return (data ?? []).map((r: Spend) => ({ ...r, cost: Number(r.cost), calls: Number(r.calls) }));
}

export async function creditsLeft(supabase: SupabaseClient, bonus?: number | null) {
  return balance(spentOn(await mySpend(supabase)), bonus ?? 0);
}

/** Checked on the server before expensive AI work, so the UI can't be bypassed. */
export async function outOfCredits(supabase: SupabaseClient, bonus?: number | null) {
  return (await creditsLeft(supabase, bonus)) <= 0 ? "You're out of credits. Top up to keep building." : null;
}
