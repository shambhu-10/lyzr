"use server";
import { requireUser } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secrets";

export type SecretRow = { id: string; env: string; name: string; last4: string; updated_at: string };
const ENVS = ["all", "development", "preview", "production"];

/** Names + last 4 only — ciphertext never leaves the server. */
export async function listSecrets(projectId: string | null) {
  const { supabase } = await requireUser();
  let q = supabase.from("secrets").select("id, env, name, last4, updated_at").order("name");
  q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
  const { data, error } = await q;
  if (error) return { error: error.message.includes("secrets") ? "Run migration 0003_secrets.sql to enable the vault." : error.message };
  return { secrets: (data ?? []) as SecretRow[] };
}

export async function setSecret(projectId: string | null, env: string, rawName: string, value: string) {
  const { supabase } = await requireUser();
  const name = rawName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^[^A-Z]+/, "");
  if (!name) return { error: "Use a name like STRIPE_SECRET_KEY" };
  if (!ENVS.includes(env)) return { error: "Unknown environment" };
  if (!value || value.length > 8000) return { error: "Value must be 1–8000 characters" };
  if (!process.env.SECRETS_KEY) return { error: "The vault isn't configured on the server (SECRETS_KEY missing)." };
  const enc = encryptSecret(value);
  const row = { project_id: projectId, env, name, ...enc, last4: value.slice(-4), updated_at: new Date().toISOString() };
  // Upsert by (owner, project, env, name) — delete-then-insert keeps it simple with the expression index.
  let del = supabase.from("secrets").delete().eq("env", env).eq("name", name);
  del = projectId ? del.eq("project_id", projectId) : del.is("project_id", null);
  await del;
  const { data, error } = await supabase.from("secrets").insert(row).select("id, env, name, last4, updated_at").single();
  if (error) return { error: error.message.includes("secrets") ? "Run migration 0003_secrets.sql to enable the vault." : error.message };
  return { secret: data as SecretRow };
}

export async function deleteSecret(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("secrets").delete().eq("id", id);
  return { ok: true };
}
