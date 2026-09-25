import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usage } from "@/lib/ai/llm";

/** Record real AI usage (tokens, latency, list-price cost) for the Usage page and project logs. */
export async function logUsage(supabase: SupabaseClient, projectId: string | null, kind: string, usage: (Usage | null | undefined)[]) {
  const rows = usage.filter((u): u is Usage => !!u).map((u) => ({ project_id: projectId, kind, ...u }));
  if (rows.length) {
    const { error } = await supabase.from("usage_events").insert(rows);
    if (error) console.error("usage log failed", error.message); // e.g. migration 0002 not applied yet — never block the user
  }
}
