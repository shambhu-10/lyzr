import type { Plan } from "./types";

/** Pre-ship security check. Pure, so it runs on the server and in `npm run check`. */
export type Finding = {
  id: string;
  rule: "hardcoded-secret" | "missing-env" | "sample-data" | "not-connected" | "agent-autonomy";
  severity: "high" | "medium" | "low";
  title: string;   // plain language, for Builders
  detail: string;  // what it means / how it's fixed
  file?: string;
  line?: number;
  excerpt?: string; // masked, never the secret itself
  fix?: "vault" | "connect" | "approval";
  envName?: string;
};

const SECRET_PATTERNS: { name: string; env: string; re: RegExp }[] = [
  { name: "Groq API key", env: "GROQ_API_KEY", re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: "Anthropic API key", env: "ANTHROPIC_API_KEY", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI API key", env: "OPENAI_API_KEY", re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: "Stripe secret key", env: "STRIPE_SECRET_KEY", re: /(?:sk|rk)_live_[A-Za-z0-9]{16,}/ },
  { name: "AWS access key", env: "AWS_ACCESS_KEY_ID", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", env: "GITHUB_TOKEN", re: /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/ },
  { name: "Slack token", env: "SLACK_TOKEN", re: /xox[abpr]-[A-Za-z0-9-]{10,}/ },
  { name: "Google API key", env: "GOOGLE_API_KEY", re: /AIza[0-9A-Za-z_-]{35}/ },
];
// `apiKey = "…"` style literals that don't match a known provider.
const GENERIC = /\b([A-Za-z_]*(?:api[_-]?key|secret|token|password|passwd)[A-Za-z_]*)\b\s*[:=]\s*["'`]([^"'`\s$]{12,})["'`]/i;
const ENV_REF = /process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g;
const PLATFORM_ENV = /^(ARCHITECT_|NODE_ENV$|NEXT_PUBLIC_|VITE_|SUPABASE_|DATABASE_URL$|SQLITE_PATH$|CLERK_|AUTH_SECRET$)/; // provisioned by Architect for the chosen stack
const RISKY_TOOL = /\b(send|post|publish|delete|remove|pay|charge|refund|transfer|email|tweet|merge)\b/i;

export const mask = (s: string) => (s.length <= 8 ? "••••" : `${s.slice(0, 4)}••••${s.slice(-4)}`);
export function envNameFor(literal: string, variable?: string) {
  const known = SECRET_PATTERNS.find((p) => p.re.test(literal))?.env;
  const fromVar = variable?.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^[^A-Z]+/, "");
  return known || fromVar || "API_KEY";
}

/** Find the first hardcoded secret on a line: the literal and a suggested env var name. */
export function secretOnLine(line: string): { literal: string; env: string; kind: string } | null {
  for (const p of SECRET_PATTERNS) { const m = p.re.exec(line); if (m) return { literal: m[0], env: p.env, kind: p.name }; }
  if (/process\.env/.test(line)) return null;
  const g = GENERIC.exec(line);
  if (g && !/^(your|xxx|placeholder|example|changeme)/i.test(g[2])) return { literal: g[2], env: envNameFor(g[2], g[1]), kind: "secret" };
  return null;
}

export function scan(input: {
  files: { path: string; content: string }[];
  plan: Plan | null;
  connections: Record<string, string>;
  demo: boolean;
  vault: string[]; // env var names set in the vault (project + workspace)
  agents?: { name: string; tools: string[]; instructions?: string }[];
}): Finding[] {
  const out: Finding[] = [];
  const vault = new Set(input.vault);
  const referenced = new Map<string, { file: string; line: number }>();

  for (const f of input.files) {
    f.content.split("\n").forEach((text, i) => {
      const s = secretOnLine(text);
      if (s) out.push({
        id: `secret:${f.path}:${i + 1}`, rule: "hardcoded-secret", severity: "high",
        title: `A ${s.kind === "secret" ? "secret" : s.kind} is written directly in your app's code`,
        detail: "Anyone who sees the code could use it. Move it to the encrypted vault — the code will read it safely instead.",
        file: f.path, line: i + 1, excerpt: text.replace(s.literal, mask(s.literal)).trim().slice(0, 140), fix: "vault", envName: s.env,
      });
      for (const m of text.matchAll(ENV_REF)) {
        const name = m[1] ?? m[2];
        if (!PLATFORM_ENV.test(name) && !referenced.has(name)) referenced.set(name, { file: f.path, line: i + 1 });
      }
    });
  }
  for (const [name, at] of referenced) if (!vault.has(name) && !input.connections[name])
    out.push({ id: `env:${name}`, rule: "missing-env", severity: "medium", title: `The app needs ${name}, but it isn't set`, detail: "Add the value in Env (or Connections) so this part works once live.", file: at.file, line: at.line, envName: name });

  for (const c of input.plan?.connections ?? []) {
    const status = input.connections[c.id];
    if (status === "connected" || (c.kind === "apikey" && vault.has(c.id))) continue;
    out.push({ id: `conn:${c.id}`, rule: "not-connected", severity: status === "sample" ? "low" : "medium", title: status === "sample" ? `${c.name} is using sample data` : `${c.name} isn't connected`, detail: `Needed ${c.why}. Visitors will see sample data until it's connected.`, fix: "connect" });
  }
  if (input.demo && !out.some((f) => f.rule === "not-connected")) out.push({ id: "demo", rule: "sample-data", severity: "low", title: "Your app still shows sample data", detail: "Fine for a demo; connect real accounts before sharing widely.", fix: "connect" });

  for (const a of input.agents ?? []) {
    const risky = a.tools.filter((t) => RISKY_TOOL.test(t));
    if (risky.length && !/approv|confirm|never send|without the user/i.test(a.instructions ?? ""))
      out.push({ id: `agent:${a.name}`, rule: "agent-autonomy", severity: "medium", title: `${a.name} can ${risky[0].toLowerCase()} without asking you`, detail: "Add an approval step so it drafts first and only acts after a person confirms.", fix: "approval" });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
