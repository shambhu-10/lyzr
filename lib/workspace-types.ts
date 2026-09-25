export type FileRow = { path: string; content: string };
export type AgentRow = { id: string; name: string; role: string; framework: string; instructions: string; tools: string[]; model: string };
export type VersionRow = { id: string; label: string; created_at: string };
