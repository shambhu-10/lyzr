import type { Stack } from "./catalog";

/** The Developer view of a plan: data model, routes and env. Pure — used by the UI, codegen and `npm run check`. */
export const COLUMN_TYPES = ["uuid", "text", "int", "numeric", "bool", "date", "timestamptz", "jsonb"] as const;
export const ACCESS = ["owner", "team", "public_read"] as const;
export const METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;

export type Column = { name: string; type: (typeof COLUMN_TYPES)[number]; nullable: boolean; note: string };
export type Table = { name: string; purpose: string; access: (typeof ACCESS)[number]; columns: Column[] };
export type TechSpec = {
  tables: Table[];
  routes: { method: (typeof METHODS)[number]; path: string; purpose: string }[];
  env: { name: string; purpose: string; provided: boolean }[];
  notes: string[];
};

const ident = (s: unknown, n = 40) => String(s ?? "").toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").replace(/_+$/, "").slice(0, n);
const clip = (s: unknown, n = 200) => String(s ?? "").slice(0, n);
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T) => (all.includes(v as T) ? (v as T) : d);
const RESERVED = new Set(["id", "owner_id", "created_at"]); // always added by schemaSql

/** Anything from the client or the model → a safe spec (valid identifiers, known types, bounded sizes). */
export function sanitizeTech(raw: unknown): TechSpec {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof TechSpec, unknown[]>>;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const seen = new Set<string>();
  const tables = arr(t.tables).slice(0, 12).flatMap((x) => {
    const r = x as Record<string, unknown>;
    const name = ident(r.name);
    if (!name || seen.has(name)) return [];
    seen.add(name);
    const cols = new Set<string>();
    const columns = arr(r.columns).slice(0, 30).flatMap((c) => {
      const k = c as Record<string, unknown>;
      const cn = ident(k.name);
      if (!cn || RESERVED.has(cn) || cols.has(cn)) return [];
      cols.add(cn);
      return [{ name: cn, type: oneOf(k.type, COLUMN_TYPES, "text"), nullable: k.nullable !== false, note: clip(k.note, 120) }];
    });
    return [{ name, purpose: clip(r.purpose), access: oneOf(r.access, ACCESS, "owner"), columns }];
  });
  const routes = arr(t.routes).slice(0, 20).flatMap((x) => {
    const r = x as Record<string, unknown>;
    const path = clip(r.path, 80).trim();
    return /^\/[\w\-/[\]{}:.]*$/.test(path) ? [{ method: oneOf(String(r.method).toUpperCase(), METHODS, "GET"), path, purpose: clip(r.purpose) }] : [];
  });
  const env = arr(t.env).slice(0, 20).flatMap((x) => {
    const r = x as Record<string, unknown>;
    const name = String(r.name ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^[^A-Z]+/, "").slice(0, 64);
    return name ? [{ name, purpose: clip(r.purpose), provided: !!r.provided }] : [];
  });
  return { tables, routes, env, notes: arr(t.notes).slice(0, 8).map((n) => clip(n, 240)).filter(Boolean) };
}

const PG: Record<Column["type"], string> = { uuid: "uuid", text: "text", int: "integer", numeric: "numeric", bool: "boolean", date: "date", timestamptz: "timestamptz", jsonb: "jsonb" };
const SQLITE: Record<Column["type"], string> = { uuid: "TEXT", text: "TEXT", int: "INTEGER", numeric: "REAL", bool: "INTEGER", date: "TEXT", timestamptz: "TEXT", jsonb: "TEXT" };

/** SQL for the chosen database. Supabase gets row-level security from each table's access level. */
export function schemaSql(tech: TechSpec, database: Stack["database"]): string {
  if (!tech.tables.length) return "-- This app doesn't store anything yet.\n";
  return tech.tables.map((t) => {
    const lite = database === "sqlite";
    const T = lite ? SQLITE : PG;
    const cols = [
      lite ? "  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))" : "  id uuid primary key default gen_random_uuid()",
      lite ? "  owner_id TEXT NOT NULL" : `  owner_id uuid not null${database === "supabase" ? " default auth.uid() references auth.users on delete cascade" : ""}`,
      ...t.columns.map((c) => `  ${c.name} ${T[c.type]}${c.nullable ? "" : lite ? " NOT NULL" : " not null"}`),
      lite ? "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" : "  created_at timestamptz not null default now()",
    ];
    let sql = `-- ${t.purpose || t.name}\n${lite ? "CREATE TABLE" : "create table"} ${t.name} (\n${cols.join(",\n")}\n);\n`;
    if (database === "supabase") {
      sql += `alter table ${t.name} enable row level security;\n`;
      if (t.access === "public_read") sql += `create policy "anyone can read" on ${t.name} for select using (true);\n`;
      if (t.access === "team") sql += `create policy "team can read" on ${t.name} for select using (auth.role() = 'authenticated');\n`;
      sql += `create policy "owner can write" on ${t.name} for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());\n`;
    } else {
      sql += `${lite ? "CREATE INDEX" : "create index"} ${t.name}_owner on ${t.name} (owner_id); -- access (${t.access}) is enforced in the API layer\n`;
    }
    return sql;
  }).join("\n");
}

/** Offline spec from the plain-language "what it saves" list. */
export function fallbackTech(data: string[], stack: Stack): TechSpec {
  return sanitizeTech({
    tables: data.map((d) => ({ name: d, purpose: d, access: "owner", columns: [{ name: "title", type: "text", nullable: false, note: "" }, { name: "details", type: "jsonb", nullable: true, note: "" }] })),
    routes: [{ method: "POST", path: "/api/agents/run", purpose: "Run an agent with input from the UI" }],
    env: providedEnv(stack),
    notes: [],
  });
}

/** Env vars Architect provisions for the chosen stack (database, auth, agent runtime). */
export function providedEnv(stack: Stack): TechSpec["env"] {
  const pub = stack.frontend === "vite" ? "VITE_" : "NEXT_PUBLIC_";
  const db = stack.database === "supabase" ? [`${pub}SUPABASE_URL`, `${pub}SUPABASE_ANON_KEY`] : stack.database === "neon" ? ["DATABASE_URL"] : ["SQLITE_PATH"];
  const auth = stack.auth === "clerk" ? [`${pub}CLERK_PUBLISHABLE_KEY`, "CLERK_SECRET_KEY"] : stack.auth === "authjs" ? ["AUTH_SECRET"] : [];
  return [...new Set([...db, ...auth, "ARCHITECT_AGENT_URL", "ARCHITECT_AGENT_TOKEN"])].map((name) => ({ name, purpose: "Provisioned by Architect", provided: true }));
}
