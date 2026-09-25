export type Mode = "builder" | "developer";
export type Stage = "plan" | "connect" | "build" | "test" | "ship" | "live";
export const STAGES: { id: Exclude<Stage, "live">; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "connect", label: "Connect" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "ship", label: "Ship" },
];

export type Question = { id: string; text: string; multi: boolean; options: { label: string; hint?: string }[] };

export type Plan = {
  name: string;
  tagline: string;
  summary: string;
  scope: { item: string; status: "in" | "later"; reason?: string }[];
  screens: { name: string; purpose: string; metrics?: { label: string; value: string }[]; rows?: { title: string; meta: string }[]; action?: string }[];
  agents: { name: string; role: string; tools: string[] }[];
  data: string[];
  connections: { id: string; name: string; why: string; kind: "oauth" | "apikey" }[];
  estimate: { credits: number; minutes: number };
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  kind: "app" | "agent" | "import";
  stage: Stage;
  plan: Plan | null;
  connections: Record<string, "connected" | "sample">;
  demo_data: boolean;
  source: { repo?: string; stack?: string } | null;
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
};
