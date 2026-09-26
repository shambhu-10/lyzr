"use server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { colKey, pickTable } from "@/lib/app-data";
import { techFor } from "@/lib/script/files";
import { toStack } from "@/lib/catalog";
import type { Plan, Project } from "@/lib/types";
import { makeSeedRows } from "@/lib/ai/planner";
import { logUsage } from "@/lib/usage-log";

export type AppRow = { id: string; table_name: string; data: Record<string, unknown>; source: "app" | "seed" | "live"; created_at: string };
const missing = (m?: string) => !!m && /app_rows|live_insert_row/.test(m);

/** A form in a generated app was submitted: store it as a real row (workspace preview as the owner, live app by slug). */
export async function saveAppRow(input: { projectId?: string; slug?: string; form: string; values: Record<string, string> }) {
  const supabase = await createClient();
  const entries = Object.entries(input.values).filter(([, v]) => v.trim()).slice(0, 30);
  if (!entries.length) return { error: "Fill in at least one field." };
  const data = Object.fromEntries(entries.map(([k, v]) => [colKey(k), v.slice(0, 2000)]));
  let plan: Plan | null = null, stack = toStack(null);
  if (input.projectId) {
    const { data: p } = await supabase.from("projects").select("plan, source").eq("id", input.projectId).single();
    plan = (p?.plan as Plan) ?? null; stack = toStack((p?.source as Project["source"])?.stack);
  } else if (input.slug) {
    const { data: rows } = await supabase.rpc("live_project", { p_slug: input.slug });
    plan = (rows?.[0]?.plan as Plan) ?? null;
  }
  if (!plan) return { error: "App not found." };
  const table = pickTable(techFor(plan, stack).tables, Object.keys(data), input.form);
  const { error } = input.projectId
    ? await supabase.from("app_rows").insert({ project_id: input.projectId, table_name: table, data, source: "app" })
    : await supabase.rpc("live_insert_row", { p_slug: input.slug, p_table: table, p_data: data });
  if (error) return { error: missing(error.message) ? "Saving needs migration 0005." : "Couldn't save." };
  return { table };
}

/** Everything the Data tab shows: the app's tables (from the tech spec, plus any a form created) with real rows. */
export async function listAppData(projectId: string) {
  const { supabase } = await requireUser();
  const [{ data: p }, { data: rows, error }] = await Promise.all([
    supabase.from("projects").select("plan, source").eq("id", projectId).single(),
    supabase.from("app_rows").select("id, table_name, data, source, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (error) return { error: missing(error.message) ? "Run migration 0005 to store your app's data." : error.message };
  const tech = p?.plan ? techFor(p.plan as Plan, toStack((p.source as Project["source"])?.stack)) : null;
  const names = [...new Set([...(tech?.tables.map((t) => t.name) ?? []), ...(rows ?? []).map((r) => r.table_name)])];
  return {
    tables: names.map((name) => ({ name, columns: tech?.tables.find((t) => t.name === name)?.columns ?? [], rows: (rows ?? []).filter((r) => r.table_name === name) as AppRow[] })),
  };
}

/** A few realistic example rows per table (once per project): after the first build, or on demand from the Data tab. */
export async function seedExampleRows(projectId: string) {
  const { supabase } = await requireUser();
  const { count, error } = await supabase.from("app_rows").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (error) return { error: missing(error.message) ? "Run migration 0005 to store your app's data." : error.message };
  if (count) return { added: 0 };
  const { data: p } = await supabase.from("projects").select("plan, source").eq("id", projectId).single();
  if (!p?.plan) return { error: "No plan yet." };
  const seed = await makeSeedRows(p.plan as Plan, techFor(p.plan as Plan, toStack((p.source as Project["source"])?.stack)).tables);
  await logUsage(supabase, projectId, "seed", seed.usage);
  if (!seed.rows.length) return { error: "Couldn't write example rows right now." };
  const { error: insErr } = await supabase.from("app_rows").insert(seed.rows.map((r) => ({ project_id: projectId, table_name: r.table, data: r.data, source: "seed" })));
  return insErr ? { error: "Couldn't save the example rows." } : { added: seed.rows.length };
}
