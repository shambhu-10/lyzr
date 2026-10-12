import "server-only";
import type { Sandbox } from "@vercel/sandbox";
import type { ChatMessage, ToolCall, ToolSpec } from "./gateway";
import { listFiles, readFile, run, writeFiles } from "@/lib/sandbox";
import { ACCENTS, DEFAULT_THEME, RADII } from "@/lib/theme";
import type { Plan } from "@/lib/types";
import { MAX_STEPS, type BuildEvent } from "@/lib/workspace-types";

/**
 * The build agent's harness: what the model sees (prompt + tools), what each tool does in the sandbox,
 * and how history is trimmed so every step stays small (our Groq key allows 8k tokens a minute).
 */

export { MAX_STEPS, type BuildEvent };

export type StepState = { history: ChatMessage[]; dirty: boolean; done?: string };

/* ---------- The fixed scaffold (agent writes src/; these stay put) ---------- */

const FONTS = { sans: "ui-sans-serif, system-ui, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, SFMono-Regular, Menlo, monospace" };

// A small design system + app shell the agent composes with (same idea as v0 + shadcn, or Lyzr's theme engine):
// consistent, polished screens for far fewer tokens than hand-written CSS.
const UI_CSS = `/* Architect UI kit — themed by theme.css. Use these classes; add to styles.css only what's missing. */
* { box-sizing: border-box; }
.app { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; }
.sidebar { background: var(--sidebar); color: var(--sidebar-fg); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid var(--line); }
.brand { font-weight: 700; font-size: 17px; padding: 4px 10px 16px; letter-spacing: -0.01em; }
.nav-item { all: unset; cursor: pointer; padding: 9px 10px; border-radius: var(--radius); font-size: 14px; opacity: .8; }
.nav-item:hover { opacity: 1; background: color-mix(in oklab, var(--sidebar-fg) 8%, transparent); }
.nav-item.active { opacity: 1; background: var(--accent); color: #fff; font-weight: 600; }
.main { padding: 28px 32px; max-width: 1100px; width: 100%; }
.page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
.page-sub { color: var(--muted); margin: 0 0 22px; font-size: 14px; }
.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 18px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: 0 1px 2px rgb(16 24 40 / .04); margin-bottom: 14px; }
.card-title { font-weight: 600; margin: 0 0 12px; font-size: 15px; }
.stat-label { color: var(--muted); font-size: 13px; }
.stat-value { font-size: 28px; font-weight: 700; margin-top: 4px; letter-spacing: -0.02em; }
.list { list-style: none; margin: 0; padding: 0; }
.list-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 4px; border-top: 1px solid var(--line); }
.list-item:first-child { border-top: 0; }
.muted { color: var(--muted); font-size: 13px; }
.badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; background: color-mix(in oklab, var(--accent) 14%, white); color: var(--accent-ink); }
.badge.gray { background: #f2f4f7; color: #475467; }
.badge.green { background: #dcfae6; color: #067647; }
.badge.amber { background: #fef0c7; color: #93370d; }
.badge.red { background: #fee4e2; color: #b42318; }
.btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--card); font-size: 14px; font-weight: 600; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn:hover { filter: brightness(.97); }
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px; border-bottom: 1px solid var(--line); }
.table td { padding: 10px 8px; border-bottom: 1px solid var(--line); }
.table tr, .table .list-item { display: table-row; } /* rows stay rows, whatever classes they get */
.field { display: grid; gap: 6px; margin-bottom: 14px; font-size: 14px; font-weight: 500; }
.input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; }
.draft { white-space: pre-wrap; background: color-mix(in oklab, var(--accent) 6%, white); border: 1px dashed var(--accent); border-radius: var(--radius); padding: 14px; font-size: 14px; margin-top: 12px; }
@media (max-width: 720px) { .app { grid-template-columns: 1fr; } .sidebar { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px; } .brand { padding: 4px 10px; width: 100%; } .main { padding: 20px 16px; } .table { display: block; overflow-x: auto; } }
`;

const SHELL = `import { useState } from "react";

/** App shell: sidebar with the app name + one nav item per screen. Pass screens as [{ name, element }]. */
export default function Shell({ title, screens }) {
  const [i, setI] = useState(0);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">{title}</div>
        {screens.map((s, n) => (
          <button key={s.name} className={"nav-item" + (n === i ? " active" : "")} onClick={() => setI(n)}>{s.name}</button>
        ))}
      </aside>
      <main className="main">{screens[i]?.element}</main>
    </div>
  );
}
`;

export function scaffold(plan: Plan) {
  const t = plan.theme ?? DEFAULT_THEME;
  const [accent, ink] = ACCENTS[t.accent] ?? ACCENTS.teal;
  const side = t.sidebar === "dark" ? ["#171A21", "#FFFFFF"] : t.sidebar === "tint" ? [`color-mix(in oklab, ${accent} 9%, white)`, "#1F2430"] : ["#FFFFFF", "#1F2430"];
  return [
    { path: "package.json", content: JSON.stringify({ name: "app", private: true, type: "module", scripts: { dev: "vite --host 0.0.0.0 --port 3000", build: "vite build" }, dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.3.0" } }, null, 2) },
    { path: "vite.config.js", content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()], server: { allowedHosts: true } });\n` },
    { path: "index.html", content: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${plan.name.replace(/[<>&]/g, "")}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n` },
    { path: "src/main.jsx", content: `import { createRoot } from "react-dom/client";\nimport "./theme.css";\nimport "./ui.css";\nimport "./styles.css";\nimport App from "./App.jsx";\n\ncreateRoot(document.getElementById("root")).render(<App />);\n` },
    { path: "src/ui.css", content: UI_CSS },
    { path: "src/Shell.jsx", content: SHELL },
    { path: "src/theme.css", content: `/* Picked look: ${t.name}. Use these variables; don't redefine them. */\n:root {\n  --accent: ${accent};\n  --accent-ink: ${ink};\n  --radius: ${RADII[t.radius] ?? RADII.soft};\n  --font: ${FONTS[t.font] ?? FONTS.sans};\n  --sidebar: ${side[0]};\n  --sidebar-fg: ${side[1]};\n  --bg: #f7f7f8;\n  --card: #ffffff;\n  --fg: #1f2430;\n  --muted: #667085;\n  --line: #e4e7ec;\n}\nbody { margin: 0; font-family: var(--font); background: var(--bg); color: var(--fg); }\n` },
    { path: "src/styles.css", content: "/* App styles: written by the build agent */\n" },
    { path: "src/App.jsx", content: `export default function App() {\n  return <p style={{ padding: 24 }}>Building…</p>;\n}\n` },
  ];
}

/* ---------- What the model sees ---------- */

export function systemPrompt(plan: Plan) {
  const screens = plan.screens.map((s) => `- ${s.name}: ${s.purpose}${s.blocks?.length ? ` (show: ${s.blocks.map((b) => `${b.type} “${b.title}”`).join(", ")})` : ""}`).join("\n");
  return `You are Architect's build agent. You write a real React app inside a sandbox, then make it build.

App: ${plan.name} — ${plan.tagline}
Screens:
${screens}
Data it works with: ${plan.data.join("; ") || "—"}
Agents (buttons in the UI that draft, never send): ${plan.agents.map((a) => `${a.name} (${a.role})`).join("; ") || "none"}

Project (Vite + React 19, plain JavaScript, already installed). Fixed files: index.html, src/main.jsx, src/theme.css, src/ui.css, src/Shell.jsx.
- src/App.jsx: import Shell from "./Shell.jsx" and render <Shell title="${plan.name.replace(/"/g, "")}" screens={[{ name, element }]} /> with one entry per screen.
- src/screens/<Name>.jsx: one per screen. src/data.js: realistic sample data (6–10 rows each).
- Style with the ui.css classes: page-title, page-sub, grid, card, card-title, stat-label, stat-value, list, list-item, muted, badge (+ "green", "amber", "red", "gray"), btn, btn-primary, table, field, input, draft. Only add src/styles.css rules for what's truly missing.
- Every screen starts with <h1 className="page-title"> and <p className="page-sub">. Use cards, stats, tables and lists so it feels like a real product.
- Only react and react-dom. No other packages, no TypeScript, no network calls. Agent buttons (btn-primary) show their result in a <div className="draft"> built from the sample data, for the user to approve — never "send".
- Keep each file under 120 lines.

How to work:
1. Write the files with write_file — at most 3 files per turn.
2. Call run_build. If it fails, read the error, fix the file, run_build again.
3. When the build passes, call finish with one sentence describing the app.`;
}

const obj = (props: Record<string, unknown>, required: string[]) => ({ type: "object", properties: props, required, additionalProperties: false });
export const TOOLS: ToolSpec[] = [
  { name: "write_file", description: "Create or overwrite a file under src/ (e.g. src/App.jsx, src/screens/Inbox.jsx, src/data.js, src/styles.css).", parameters: obj({ path: { type: "string" }, content: { type: "string" } }, ["path", "content"]) },
  { name: "read_file", description: "Read a file in the project.", parameters: obj({ path: { type: "string" } }, ["path"]) },
  { name: "list_files", description: "List the project's files.", parameters: obj({}, []) },
  { name: "run_build", description: "Run the production build (vite build). Returns the errors if it fails.", parameters: obj({}, []) },
  { name: "finish", description: "Call once the build passes. One sentence describing what the app does.", parameters: obj({ summary: { type: "string" } }, ["summary"]) },
];

/* ---------- What each tool does ---------- */

const WRITABLE = /^src\/(?!main\.jsx$|theme\.css$|ui\.css$|Shell\.jsx$)[\w-]+(\/[\w-]+)*\.(jsx|js|css)$/;

export async function runTool(sb: Sandbox, call: ToolCall, state: StepState, events: BuildEvent[]): Promise<string> {
  let args: Record<string, string>;
  try { args = JSON.parse(call.args || "{}"); } catch { return "Your tool call was cut off or invalid JSON. Write fewer or shorter files per turn."; }
  switch (call.name) {
    case "write_file": {
      const path = String(args.path ?? "").replace(/^\.?\//, "");
      if (!WRITABLE.test(path)) return `Can't write ${path}: only .jsx/.js/.css files under src/ (not the fixed files).`;
      const content = String(args.content ?? "");
      await writeFiles(sb, [{ path, content }]);
      state.dirty = true;
      events.push({ t: "file", path, lines: content.split("\n").length });
      return `Wrote ${path}.`;
    }
    case "read_file": {
      const text = await readFile(sb, String(args.path ?? "").replace(/^\.?\//, ""));
      return text === null ? "Not found." : text.slice(0, 6000);
    }
    case "list_files":
      return (await listFiles(sb)).join("\n");
    case "run_build": {
      const r = await build(sb, events);
      state.dirty = !r.ok;
      return r.ok ? "Build passed." : `Build failed:\n${r.output}`;
    }
    case "finish": {
      if (state.dirty) { // never trust "done" — verify
        const r = await build(sb, events);
        if (!r.ok) return `The build still fails, so you can't finish yet:\n${r.output}`;
        state.dirty = false;
      }
      state.done = String(args.summary ?? "").slice(0, 300) || "Built the app.";
      return "Done.";
    }
    default:
      return `Unknown tool ${call.name}.`;
  }
}

async function build(sb: Sandbox, events: BuildEvent[]) {
  const r = await run(sb, "npm", ["run", "build"], 2500);
  events.push({ t: "build", ok: r.ok, tail: r.output.split("\n").filter(Boolean).slice(-6).join("\n") });
  return r;
}

/** Keep only what the next step needs: old file contents become a one-liner, old build logs get short. */
export function compact(history: ChatMessage[]): ChatMessage[] {
  const lastAssistant = history.findLastIndex((m) => m.role === "assistant");
  return history.map((m, i) => {
    if (i >= lastAssistant) return m;
    if (m.role === "assistant" && m.toolCalls?.some((c) => c.name === "write_file"))
      return { ...m, toolCalls: m.toolCalls.map((c) => (c.name === "write_file" ? { ...c, args: JSON.stringify({ path: safePath(c.args), content: "(written earlier — read_file to see it)" }) } : c)) };
    if (m.role === "tool" && m.content.length > 400) return { ...m, content: `${m.content.slice(0, 400)}…` };
    return m;
  });
}
const safePath = (args: string) => { try { return String(JSON.parse(args).path); } catch { return "?"; } };
