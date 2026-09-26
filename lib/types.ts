import type { AppTheme } from "./theme";
import type { Stack } from "./catalog";
import type { TechSpec } from "./tech-spec";
export type Mode = "builder" | "developer";
export type Stage = "plan" | "connect" | "build" | "test" | "ship" | "live";
export const STAGES: { id: Exclude<Stage, "live">; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "connect", label: "Connect" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "ship", label: "Ship" },
];

export type Question = { id: string; text: string; why?: string; multi: boolean; options: { label: string; hint?: string }[] };

export type Block = {
  type: "stats" | "list" | "table" | "form" | "detail" | "text" | "agent";
  title: string;
  body: string;
  items: { title: string; meta: string; badge: string }[];
  columns: string[];
  rows: string[][];
  fields: { label: string; kind: "text" | "textarea" | "select" | "file"; placeholder: string }[];
  action: string;
  agent: string;
  source: "static" | "google-calendar" | "selection";
};

export type Screen = { name: string; purpose: string; metrics?: { label: string; value: string }[]; rows?: { title: string; meta: string }[]; action?: string; blocks?: Block[] };

export type Plan = {
  name: string;
  tagline: string;
  summary: string;
  scope: { item: string; status: "in" | "later"; reason?: string }[];
  screens: Screen[];
  agents: { name: string; role: string; tools: string[] }[];
  data: string[];
  connections: { id: string; name: string; why: string; kind: "oauth" | "apikey" }[];
  estimate: { credits: number; minutes: number };
  theme?: AppTheme;
  looks?: AppTheme[];
  /** Developer view: data model, routes, env (lib/tech-spec.ts). */
  tech?: TechSpec;
  /** Agent projects only: how the agent runs, what it must never do, and cases it must pass. */
  trigger?: { kind: "chat" | "api" | "schedule" | "slack" | "email"; detail: string };
  guardrails?: string[];
  tests?: { input: string; expect: string }[];
};

export type Project = {
  id: string;
  owner_id?: string;
  showcase?: boolean;
  showcase_author?: string | null;
  views?: number;
  remixes?: number;
  name: string;
  slug: string;
  prompt: string;
  kind: "app" | "agent" | "import";
  stage: Stage;
  plan: Plan | null;
  connections: Record<string, "connected" | "sample">;
  demo_data: boolean;
  source: { repo?: string; language?: string; stack?: Stack; framework?: string; template?: boolean; remixed_from?: string; lens?: Mode; autoKind?: boolean; theme?: AppTheme; build?: { seconds: number; at: string } } | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  org_name: string | null;
  role: string | null;
  default_mode: Mode;
  onboarded: boolean;
  bonus_credits?: number;
};
