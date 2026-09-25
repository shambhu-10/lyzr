export type FileRow = { path: string; content: string };
export type AgentRow = { id: string; name: string; role: string; framework: string; instructions: string; tools: string[]; model: string; evals?: { input: string; expect: string; pass?: boolean; reason?: string; output?: string }[] };
export type VersionRow = { id: string; label: string; created_at: string; summary?: string | null; changes?: string[] | null; diff?: { path: string; added: number; removed: number }[] | null };
