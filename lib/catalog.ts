export const FRAMEWORKS = [
  { id: "lyzr", label: "Lyzr", lang: "Python" },
  { id: "langgraph", label: "LangGraph", lang: "Python" },
  { id: "crewai", label: "CrewAI", lang: "Python" },
  { id: "openai-agents", label: "OpenAI Agents SDK", lang: "Python" },
  { id: "adk", label: "Google ADK", lang: "Python" },
  { id: "mastra", label: "Mastra", lang: "TypeScript" },
] as const;

/** Models agents actually run on (ids verified against this Groq key — see lib/ai/llm.ts CHAT_MODELS). */
export const MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B · Groq" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B · Groq" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B · Groq" },
] as const;

/** Providers on the roadmap — shown in the model picker as "Soon", not selectable. */
export const SOON_MODELS = [
  { provider: "OpenAI", models: ["GPT-5", "GPT-5 mini"] },
  { provider: "Anthropic", models: ["Claude Opus 5.5", "Claude Sonnet 5", "Claude Haiku 4.5"] },
  { provider: "Google", models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"] },
  { provider: "Mistral", models: ["Mistral Large"] },
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
  model: (typeof MODELS)[number]["id"];
};
export const DEFAULT_STACK: Stack = { frontend: "nextjs", database: "supabase", auth: "supabase", model: "openai/gpt-oss-120b" };

/** Any stored/submitted value → a valid stack (unknown values fall back to the default). */
export function toStack(raw: unknown): Stack {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, ids: readonly { id: T }[], d: T) => (ids.some((x) => x.id === v) ? (v as T) : d);
  return {
    frontend: pick(r.frontend, STACK.frontend, DEFAULT_STACK.frontend),
    database: pick(r.database, STACK.database, DEFAULT_STACK.database),
    auth: pick(r.auth, STACK.auth, DEFAULT_STACK.auth),
    model: pick(r.model, MODELS, DEFAULT_STACK.model),
  };
}

export const frameworkLabel = (id?: string) => FRAMEWORKS.find((f) => f.id === id)?.label ?? "Lyzr";
export const stackLabel = (s: Stack) => [STACK.frontend, STACK.database, STACK.auth].map((opts, i) => opts.find((o) => o.id === [s.frontend, s.database, s.auth][i])?.label).join(" · ");
export const modelLabel = (id?: string) => MODELS.find((m) => m.id === id)?.label ?? id ?? "";
