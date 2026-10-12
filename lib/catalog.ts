import { DEFAULT_MODEL, MODEL_REGISTRY } from "@/lib/ai/models";

export const FRAMEWORKS = [
  { id: "lyzr", label: "Lyzr", lang: "Python" },
  { id: "langgraph", label: "LangGraph", lang: "Python" },
  { id: "crewai", label: "CrewAI", lang: "Python" },
  { id: "openai-agents", label: "OpenAI Agents SDK", lang: "Python" },
  { id: "adk", label: "Google ADK", lang: "Python" },
  { id: "mastra", label: "Mastra", lang: "TypeScript" },
] as const;

/** Stack options. Each one changes the generated code (lib/script/files.ts) and the tech spec. */
export const STACK = {
  frontend: [{ id: "nextjs", label: "Next.js (App Router)" }, { id: "vite", label: "React + Vite" }],
  database: [{ id: "supabase", label: "Supabase Postgres" }, { id: "neon", label: "Neon Postgres" }, { id: "sqlite", label: "SQLite" }],
  auth: [{ id: "supabase", label: "Supabase Auth" }, { id: "clerk", label: "Clerk" }, { id: "authjs", label: "Auth.js" }],
} as const;

export type Stack = {
  frontend: (typeof STACK.frontend)[number]["id"];
  database: (typeof STACK.database)[number]["id"];
  auth: (typeof STACK.auth)[number]["id"];
  model: string; // a lib/ai/models registry id
};
export const DEFAULT_STACK: Stack = { frontend: "nextjs", database: "supabase", auth: "supabase", model: DEFAULT_MODEL };

/** Any stored/submitted value → a valid stack (unknown values fall back to the default). */
export function toStack(raw: unknown): Stack {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ids: readonly { id: T }[], d: T) => (ids.some((x) => x.id === v) ? (v as T) : d);
  return {
    frontend: pick(r.frontend, STACK.frontend, DEFAULT_STACK.frontend),
    database: pick(r.database, STACK.database, DEFAULT_STACK.database),
    auth: pick(r.auth, STACK.auth, DEFAULT_STACK.auth),
    model: pick(r.model, MODEL_REGISTRY, DEFAULT_STACK.model),
  };
}

export const frameworkLabel = (id?: string) => FRAMEWORKS.find((f) => f.id === id)?.label ?? "Lyzr";
export const stackLabel = (s: Stack) => [STACK.frontend, STACK.database, STACK.auth].map((opts, i) => opts.find((o) => o.id === [s.frontend, s.database, s.auth][i])?.label).join(" · ");
