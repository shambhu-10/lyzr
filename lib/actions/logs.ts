"use server";
import { requireUser } from "@/lib/supabase/server";

export type UsageRow = { id: string; kind: string; model: string; input_tokens: number; output_tokens: number; ms: number; cost_usd: number | null; created_at: string };

export async function projectLogs(projectId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("usage_events").select("id, kind, model, input_tokens, output_tokens, ms, cost_usd, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as UsageRow[];
}
