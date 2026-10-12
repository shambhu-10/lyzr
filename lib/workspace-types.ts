export type FileRow = { path: string; content: string };
export type AgentRow = { id: string; name: string; role: string; framework: string; instructions: string; tools: string[]; model: string; evals?: { input: string; expect: string; pass?: boolean; reason?: string; output?: string }[] };
export type VersionRow = { id: string; label: string; created_at: string; summary?: string | null; changes?: string[] | null; diff?: { path: string; added: number; removed: number }[] | null };

/** Real (sandbox) builds — shared by the build agent (lib/ai/builder.ts) and the workspace UI. */
export const MAX_STEPS = 16;
export type BuildEvent =
  | { t: "file"; path: string; lines: number }
  | { t: "build"; ok: boolean; tail: string }
  | { t: "note"; text: string }
  | { t: "error"; text: string }
  | { t: "done"; summary: string; url: string };
export type RunLite = { id: string; status: "running" | "done" | "failed"; step: number; events: BuildEvent[]; usage: { tokens?: number; cost?: number; model?: string } };
