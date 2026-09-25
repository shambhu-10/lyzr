import type { Plan } from "@/lib/types";
import { DEFAULT_STACK, STACK, type Stack } from "@/lib/catalog";
import { fallbackTech, providedEnv, schemaSql, type TechSpec } from "@/lib/tech-spec";

export type GenFile = { path: string; content: string; role?: "screen" };

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const snake = (s: string) => slug(s).replace(/-/g, "_");
const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toUpperCase());

export function agentCode(a: Plan["agents"][number], framework: string): GenFile {
  const n = snake(a.name);
  const tools = a.tools.map((t) => `"${slug(t)}"`).join(", ");
  const instr = `${a.role}. Ground every answer in the provided data; say what's missing instead of guessing.`;
  const py = (body: string): GenFile => ({ path: `agents/${n}.py`, content: body.trim() + "\n" });
  switch (framework) {
    case "langgraph":
      return py(`
from langgraph.prebuilt import create_react_agent
from architect.tools import load_tools

${n} = create_react_agent(
    model="groq:openai/gpt-oss-120b",
    tools=load_tools([${tools}]),
    prompt="""${instr}""",
)
`);
    case "crewai":
      return py(`
from crewai import Agent, Task, Crew
from architect.tools import load_tools

${n} = Agent(
    role="${a.name}",
    goal="${a.role}",
    backstory="""${instr}""",
    tools=load_tools([${tools}]),
    llm="groq/openai/gpt-oss-120b",
)

def run(inputs: dict) -> str:
    task = Task(description="{request}", expected_output="A concise, grounded result", agent=${n})
    return Crew(agents=[${n}], tasks=[task]).kickoff(inputs=inputs).raw
`);
    case "openai-agents":
      return py(`
from agents import Agent, Runner
from agents.extensions.models.litellm_model import LitellmModel
from architect.tools import load_tools

${n} = Agent(
    name="${a.name}",
    instructions="""${instr}""",
    model=LitellmModel(model="groq/openai/gpt-oss-120b"),
    tools=load_tools([${tools}]),
)

async def run(request: str) -> str:
    result = await Runner.run(${n}, request)
    return result.final_output
`);
    case "adk":
      return py(`
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from architect.tools import load_tools

root_agent = Agent(
    name="${n}",
    model=LiteLlm(model="groq/openai/gpt-oss-120b"),
    description="${a.role}",
    instruction="""${instr}""",
    tools=load_tools([${tools}]),
)
`);
    case "mastra":
      return {
        path: `agents/${slug(a.name)}.ts`,
        content: `import { Agent } from "@mastra/core/agent";
import { groq } from "@ai-sdk/groq";
import { loadTools } from "@/lib/tools";

export const ${pascal(a.name).replace(/^./, (c) => c.toLowerCase())} = new Agent({
  name: "${a.name}",
  instructions: \`${instr}\`,
  model: groq("openai/gpt-oss-120b"),
  tools: loadTools([${tools}]),
});
`,
      };
    default:
      // Lyzr ADK (docs.lyzr.ai/lyzr-adk): pip install lyzr-adk
      return py(`
import os
from lyzr import Studio

studio = Studio(api_key=os.environ["LYZR_API_KEY"])

${n} = studio.create_agent(
    name="${a.name}",
    provider="gpt-4o",
    role="${a.name}",
    goal="${a.role}",
    instructions="""${instr}""",
)

def run(message: str) -> str:
    return ${n}.run(message).response
`);
  }
}

export const screenPath = (stack: Stack, name: string, i: number) =>
  stack.frontend === "vite" ? `src/pages/${pascal(name)}.tsx` : `app/${i === 0 ? "" : `${slug(name)}/`}page.tsx`;
export const schemaPath = (stack: Stack) => (stack.database === "supabase" ? "supabase/migrations/0001_init.sql" : "db/schema.sql");
export const techFor = (plan: Plan, stack: Stack): TechSpec => plan.tech ?? fallbackTech(plan.data, stack);

const DEPS: Record<string, string[]> = {
  nextjs: ["next", "react", "react-dom"],
  vite: ["react", "react-dom", "react-router", "hono", "@hono/node-server"],
  "db:supabase": ["@supabase/supabase-js"], "db:neon": ["@neondatabase/serverless"], "db:sqlite": ["better-sqlite3"],
  "auth:supabase:nextjs": ["@supabase/ssr"], "auth:supabase:vite": [],
  "auth:clerk:nextjs": ["@clerk/nextjs"], "auth:clerk:vite": ["@clerk/clerk-react", "@hono/clerk-auth"],
  "auth:authjs:nextjs": ["next-auth@beta"], "auth:authjs:vite": ["@hono/auth-js", "@auth/core"],
};
const DEV_DEPS: Record<string, string[]> = { nextjs: ["typescript", "@types/react", "tailwindcss"], vite: ["vite", "@vitejs/plugin-react", "typescript", "@types/react", "tailwindcss", "tsx", "concurrently"] };

function dbClient(stack: Stack): string {
  const pub = stack.frontend === "vite" ? "VITE_" : "NEXT_PUBLIC_";
  if (stack.database === "supabase") return `import { createClient } from "@supabase/supabase-js";\n\n// Row-level security does the access control; this client acts as the signed-in user.\nexport const db = createClient(process.env.${pub}SUPABASE_URL!, process.env.${pub}SUPABASE_ANON_KEY!);\n`;
  if (stack.database === "neon") return `import { neon } from "@neondatabase/serverless";\n\n// Serverless Postgres over HTTP. Always filter by owner_id — access is enforced here, not in the database.\nexport const sql = neon(process.env.DATABASE_URL!);\n`;
  return `import Database from "better-sqlite3";\n\n// Single-file database. Always filter by owner_id — access is enforced here, not in the database.\nexport const db = new Database(process.env.SQLITE_PATH ?? "app.db");\ndb.pragma("journal_mode = WAL");\n`;
}

function authFiles(stack: Stack): GenFile[] {
  const next = stack.frontend === "nextjs";
  if (stack.auth === "supabase")
    return next ? [{ path: "proxy.ts", content: `import { createServerClient } from "@supabase/ssr";\nimport { NextResponse, type NextRequest } from "next/server";\n\n// Refresh the session on every request; signed-out visitors go to /login.\nexport async function proxy(request: NextRequest) {\n  const response = NextResponse.next({ request });\n  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {\n    cookies: { getAll: () => request.cookies.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },\n  });\n  const { data } = await supabase.auth.getClaims();\n  if (!data?.claims && !request.nextUrl.pathname.startsWith("/login")) return NextResponse.redirect(new URL("/login", request.url));\n  return response;\n}\n` }]
      : [{ path: "src/lib/auth.ts", content: `import { createClient } from "@supabase/supabase-js";\n\nexport const auth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY).auth;\nexport const signIn = () => auth.signInWithOAuth({ provider: "google" });\n` }];
  if (stack.auth === "clerk")
    return next ? [{ path: "proxy.ts", content: `import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";\n\nconst isPublic = createRouteMatcher(["/login(.*)"]);\nexport default clerkMiddleware(async (auth, req) => { if (!isPublic(req)) await auth.protect(); });\n` }]
      : [{ path: "server/auth.ts", content: `import { clerkMiddleware, getAuth } from "@hono/clerk-auth";\n\nexport const requireUser = clerkMiddleware();\nexport const userId = (c: Parameters<typeof getAuth>[0]) => getAuth(c)?.userId ?? null;\n` }];
  return next ? [{ path: "auth.ts", content: `import NextAuth from "next-auth";\nimport Google from "next-auth/providers/google";\n\nexport const { handlers, auth, signIn, signOut } = NextAuth({ providers: [Google] });\n` }, { path: "app/api/auth/[...nextauth]/route.ts", content: `import { handlers } from "@/auth";\n\nexport const { GET, POST } = handlers;\n` }]
    : [{ path: "server/auth.ts", content: `import { authHandler, initAuthConfig, verifyAuth } from "@hono/auth-js";\nimport Google from "@auth/core/providers/google";\n\nexport const authConfig = initAuthConfig(() => ({ secret: process.env.AUTH_SECRET, providers: [Google] }));\nexport { authHandler, verifyAuth };\n` }];
}

export function filesFor(plan: Plan, framework = "lyzr", stack: Stack = DEFAULT_STACK): GenFile[] {
  const screens = plan.screens.map((s, i) => ({ ...s, route: slug(s.name), file: screenPath(stack, s.name, i) }));
  const tech = techFor(plan, stack);
  const vite = stack.frontend === "vite";
  const label = (group: keyof typeof STACK, id: string) => STACK[group].find((o) => o.id === id)?.label ?? id;
  const deps = [...DEPS[stack.frontend], ...DEPS[`db:${stack.database}`], ...DEPS[`auth:${stack.auth}:${stack.frontend}`]];
  const blockData = (s: (typeof screens)[number]) => JSON.stringify((s.blocks ?? []).map(({ type, title, body, items, columns, rows, fields, action, agent, source }) => Object.fromEntries(Object.entries({ type, title, body, items, columns, rows, fields, action, agent, source }).filter(([, v]) => (Array.isArray(v) ? v.length : v && v !== "static")))), null, 2);
  const page = (s: (typeof screens)[number]): GenFile => ({
    path: s.file, role: "screen",
    content: `// ${s.name} — ${s.purpose}
// Layout generated by Architect. Edit the blocks, or replace them with your own components.
import { Blocks, type Block } from "${vite ? "../components/blocks" : "@/components/blocks"}";

const blocks: Block[] = ${blockData(s)};

export default function ${pascal(s.name)}Page() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">${s.name}</h1>
        <p className="text-muted-foreground">${s.purpose}</p>
      </header>
      <Blocks blocks={blocks} />
    </section>
  );
}
`,
  });
  const agentIds = plan.agents.map((a) => `"${slug(a.name)}"`).join(" | ") || "string";
  const runtime = `// Calls agents running in Architect's agent runtime (any framework, one HTTP contract). Server-only: holds the token.
export async function runAgent(agent: ${agentIds}, input: Record<string, unknown>) {
  const res = await fetch(\`\${process.env.ARCHITECT_AGENT_URL}/agents/\${agent}/run\`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: \`Bearer \${process.env.ARCHITECT_AGENT_TOKEN}\` },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(\`Agent \${agent} failed: \${res.status}\`);
  return res.json();
}
`;

  const files: GenFile[] = [
    {
      path: "AGENTS.md",
      content: `# ${plan.name}

${plan.summary}

## Scope (v1)
${plan.scope.map((s) => `- [${s.status === "in" ? "x" : " "}] ${s.item}${s.reason ? ` — ${s.reason}` : ""}`).join("\n")}
${screens.length ? `
## Screens
${screens.map((s) => `- **${s.name}** (\`/${s.route}\`) — ${s.purpose}`).join("\n")}
` : ""}
## Agents
${plan.agents.map((a) => `- **${a.name}**: ${a.role}${a.tools.length ? ` (tools: ${a.tools.join(", ")})` : ""}`).join("\n")}
${plan.trigger ? `
## How it runs
- Trigger: ${plan.trigger.kind} — ${plan.trigger.detail}
${(plan.guardrails ?? []).map((g) => `- Never: ${g}`).join("\n")}
` : ""}
## Stack
- Frontend: ${label("frontend", stack.frontend)}
- Database: ${label("database", stack.database)}
- Auth: ${label("auth", stack.auth)}
- Agents: ${framework} · ${stack.model}
${tech.tables.length ? `
## Data model
${tech.tables.map((t) => `- \`${t.name}\` (${t.access}) — ${t.purpose}: ${["id", "owner_id", ...t.columns.map((c) => `${c.name} ${c.type}`), "created_at"].join(", ")}`).join("\n")}
` : ""}
## Conventions
- Never send, post or write to external tools without explicit user approval.
- Secrets come from the workspace vault as env vars; never hard-code them.
- Every agent response must be grounded in provided data.
`,
    },
    {
      path: "package.json",
      content: JSON.stringify({
        name: slug(plan.name) || "app", private: true, type: "module",
        scripts: vite ? { dev: "concurrently \"vite\" \"tsx watch server/index.ts\"", build: "vite build", start: "tsx server/index.ts" } : { dev: "next dev", build: "next build", start: "next start" },
        dependencies: Object.fromEntries(deps.map((d) => { const at = d.lastIndexOf("@"); return at > 0 ? [d.slice(0, at), d.slice(at + 1)] : [d, "latest"]; })),
        devDependencies: Object.fromEntries(DEV_DEPS[stack.frontend].map((d) => [d, "latest"])),
      }, null, 2) + "\n",
    },
  ];

  if (vite) {
    if (screens.length) files.push(
      { path: "index.html", content: `<!doctype html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${plan.name}</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n` },
      { path: "src/main.tsx", content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { createBrowserRouter, RouterProvider } from "react-router";\n${stack.auth === "clerk" ? `import { ClerkProvider } from "@clerk/clerk-react";\n` : ""}import "./index.css";\n${screens.map((s) => `import ${pascal(s.name)} from "./pages/${pascal(s.name)}";`).join("\n")}\n\nconst router = createBrowserRouter([\n${screens.map((s, i) => `  { path: "/${i === 0 ? "" : s.route}", element: <${pascal(s.name)} /> },`).join("\n")}\n]);\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>${stack.auth === "clerk" ? `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>` : ""}<RouterProvider router={router} />${stack.auth === "clerk" ? "</ClerkProvider>" : ""}</StrictMode>,\n);\n` },
      ...screens.map(page),
      { path: "src/lib/agents.ts", content: `// Browser side: agents are called through our own server so the runtime token never reaches the client.\nexport async function runAgent(agent: ${agentIds}, input: Record<string, unknown>) {\n  const res = await fetch(\`/api/agents/\${agent}\`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }) });\n  if (!res.ok) throw new Error(\`Agent \${agent} failed: \${res.status}\`);\n  return res.json();\n}\n` },
    );
    files.push(
      { path: "server/index.ts", content: `import { Hono } from "hono";\nimport { serve } from "@hono/node-server";\nimport { runAgent } from "./agents";\n\nconst app = new Hono();\n\n// POST /api/agents/:agent  { input } → the agent's result${plan.trigger?.kind === "api" ? " (this is the public API of this agent)" : ""}\napp.post("/api/agents/:agent", async (c) => c.json(await runAgent(c.req.param("agent") as never, (await c.req.json()).input ?? {})));\n\nserve({ fetch: app.fetch, port: 8787 });\n` },
      { path: "server/agents.ts", content: runtime },
      { path: "server/db.ts", content: dbClient(stack).replace(/import\.meta\.env/g, "process.env") },
    );
  } else {
    if (screens.length) files.push(
      {
        path: "app/layout.tsx",
        content: `import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata = { title: "${plan.name}", description: "${plan.tagline}" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar links={${JSON.stringify(screens.map((s) => ({ href: `/${s.route}`, label: s.name })))}} />
        <main className="flex-1 p-8">{children}</main>
      </body>
    </html>
  );
}
`,
      },
      ...screens.map(page),
    );
    files.push(
      { path: "lib/agents.ts", content: runtime },
      { path: "app/api/agents/[agent]/route.ts", content: `import { runAgent } from "@/lib/agents";\n\n// POST /api/agents/:agent  { input } → the agent's result${plan.trigger?.kind === "api" ? " (this is the public API of this agent)" : ""}\nexport async function POST(req: Request, ctx: RouteContext<"/api/agents/[agent]">) {\n  const { agent } = await ctx.params;\n  const { input } = await req.json();\n  return Response.json(await runAgent(agent as never, input ?? {}));\n}\n` },
      { path: "lib/db.ts", content: dbClient(stack) },
    );
  }
  files.push(...authFiles(stack), ...plan.agents.map((a) => agentCode(a, framework)));
  if (tech.tables.length) files.push({ path: schemaPath(stack), content: schemaSql(tech, stack.database) });
  files.push({ path: ".env.example", content: [...providedEnv(stack).map((e) => e.name), ...plan.connections.filter((c) => c.kind === "apikey").map((c) => c.id)].map((n) => `${n}=`).join("\n") + "\n" });
  return files;
}
