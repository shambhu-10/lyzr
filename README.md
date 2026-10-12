# Architect 2.0

**Describe it. Build it. Own it.** A redesign of Lyzr's architect.new. It is built for everyone who makes agentic apps: business users *and* developers work in one product, on one project, through two views.

> Take-home assignment for the Technical Product Manager role at Lyzr.

---

## The problem, from first principles

I used today's Architect end to end: I built "Briefly", a meeting-brief assistant. I also studied Lovable, v0, Bolt, Rocket, Replit, Emergent, Cursor, Codex and Claude Code. Here is what I found:

| What I saw in Architect today | Why it matters |
|---|---|
| 10 of the 17 sidebar items are learning content, and projects open in a modal | People come to *work*, but the navigation is built for *browsing* |
| "Project", "app", "agent" and "agentlet" are used for overlapping things. There are 3 views of projects and 4 places to find ideas | Users can't form a mental model of the product |
| The tagline says "for Business Executives & Consultants" | Developers are excluded on the first screen |
| Non-technical users see internals (raw app IDs, `manifest.json`, "temperature"). Developers get no workspace | The UI works for neither audience |
| My prompt asked for briefs, transcripts and follow-up emails. The plan quietly dropped two of the three | Silent scope cuts break trust |
| No cost or time estimate before committing credits. It promised "4–6 min" and took about 20 | Surprise spend is the #1 complaint across the whole category |
| The app never asked me to connect Google Calendar, so it ran on **sample data** without me noticing | "It works" wasn't true, and I couldn't tell |
| Building is a 20-minute black box with a carousel and a mini-game | The most exciting moment is hidden |
| Editing an agent sends you to a separate product (Lyzr Studio) | Context switching, and developers can't debug in place |

Across competitors, the gaps are the same: users pay credits while the AI fixes its own mistakes, security is an afterthought, and every tool serves one audience (Lovable and Rocket hide the code, v0 and Bolt assume a developer). Nobody lets you build agents in any framework.

## The solution

### 1. One project, two views
The same project can be viewed two ways, and a toggle in the header switches between them anytime. Nothing is duplicated.

| | Builder view | Developer view |
|---|---|---|
| Plan | Readable plan with a scope list | The same plan as `AGENTS.md` |
| Build | Screens appear as they're built, with a plain-English checklist | File tree, editable Monaco editor, live diffs, terminal, "Pause AI & edit by hand" |
| Errors | "Fixing a small issue (1/3) — free" | The diff of the fix |
| Agents | Role, instructions, tools, knowledge, guardrails, playground | Framework (Lyzr, LangGraph, CrewAI, OpenAI Agents SDK, Google ADK, Mastra), code, model, traces, evals |
| GitHub | "Back up to GitHub" switch | Branch per session, push, open PR |

### 2. Every project follows five visible steps: Plan → Connect → Build → Test → Ship
- **Plan:** the AI asks clarifying questions as clickable cards, then writes a plan. The plan has a **scope list** (in v1 / later, with "Add back"). It also shows a **cost and time estimate** calculated from the plan, so the numbers aren't made up by the model.
- **Connect:** new in 2.0. Required accounts and keys are connected *before* building, through a consent screen that lists the exact permissions. You can also choose "Use sample data for now", and the app then carries a visible **Demo data** badge until it goes live.
- **Build:** you watch the app assemble, or open the code. It fixes its own errors, those fixes are free, and it stops after 3 attempts.
- **Test:** plain-language checks, plus an agent playground on sample data.
- **Ship:** a pre-flight check covers security (row-level security), secrets, accessibility and sample data. Then you choose preview or production, and get a live URL with a receipt of what was spent.

### 3. Navigation: 8 items instead of 17
Home · Projects · Agents · Connections · Explore | Usage & billing · Settings · Help.
- **Explore** combines the prompt library, marketplace, resources and "What should I build?" into one hub. **Every current feature is kept**; it's just grouped better.
- **Agents** and **Connections** belong to the workspace, so you can reuse them across projects.

### 4. More in 2.0
- **Screens designed by AI while you watch.** Each screen is laid out as blocks (lists, stats, tables, forms, agent actions) by the model during Build.
- **Real change requests.** "Add a search box to the inbox" edits the screens and regenerates their code. It also saves a version with a plain-language summary, and a per-file diff in Developer view.
- **Agent buttons that actually work.** Inside the generated app, and on the public live URL, agent buttons run the real agent on the screen's data.
- **Real Google Calendar.** It uses read-only OAuth, so Briefly shows your actual meetings.
- **Comments on the preview.** Click any part of the app to comment, then send the comments to Architect as one change.
- **Plain-English tests for agents.** Write "should never promise a refund"; each test runs the agent, and an AI judge grades the answer.
- **Real cost tracking.** Every model call is metered from the provider's reported token counts and list prices.
- **For developers:** Environments, Logs, "Download code" (zip), "Open in Cursor", and a ⌘K command palette.
- **Editable plan:** click any text in the plan to change it, add or remove screens, agents and scope items, and undo. Developers can also edit `AGENTS.md` directly; the app reads it back into the plan.
- **Clarifying questions like a senior teammate:** each question comes with a "why I'm asking" line, a recommended option, an "Other…" free-text answer, and "Use all recommended". Developer view adds a technical question. Vague change requests ("make it better") get a quick question before anything changes.
- **Resizable workspace:** drag the divider between chat and app, collapse the chat into a thin bar, double-click to reset. Sizes are remembered.
- **Voice input:** tap the mic in the chat panel or on Home. Groq Whisper transcribes the recording, and you can edit the text before sending.
- **Copilot-style code editor:** ghost-text autocomplete (Tab to accept), ⌘K "Edit with AI" on a selection, and right-click "Fix with AI" or "Explain in chat". The chat becomes code-aware in the Code tab (`@file`), and every AI edit is shown as a side-by-side diff to accept or reject.
- **Focus mode:** during a build you can turn on calm, generated ambient music (Web Audio, so no audio files or licensing). It shows "while you wait" suggestions and plays a chime when the build finishes.
- **Onboarding:** one-click templates (skip the questions), a sample project, a first-run tour, and a browser notification when a build finishes.

## What's real and what's simulated

| Real | Simulated (clearly labelled in the UI) |
|---|---|
| **Real builds in a sandbox**: an AI agent writes a React + Vite app inside a Vercel Sandbox (Firecracker microVM), runs `vite build`, fixes errors, and only finishes when the build passes. The preview is the running app | The quick build (agent projects, or when sandboxes aren't configured): timeline + template code |
| **Model gateway**: one `generate()` for Groq, Claude (official SDK), OpenAI and Gemini, with tool calls, JSON schemas, cost per call, rate-limit waits and same-tier fallback. A provider is enabled by adding its key | Permission screens for third-party tools other than Google Calendar |
| **Metered credits**: balance = $20 + bonus − real spend from an append-only usage ledger; the server refuses AI work at $0 | Deploy progress animation (the live URL renders the app from its plan) |
| **GitHub push**: first push creates a private repo, every push is one commit (never forced); a branch opens a pull request | Agent traces, custom domains, Top up checkout, Settings team/billing tabs |
| Sign-in with Google, GitHub and email magic link (Supabase); Postgres with row-level security on every table | Import's repo "analysis" (it lists your real repos) |
| AI clarifying questions and structured plan (strict JSON-schema outputs validated with zod) | |
| Agent playground chat and evals with an AI judge | |
| AI screen layouts, change requests with summaries and diffs, edit-text and look changes as versions | |
| Editor AI: autocomplete, ⌘K edits with diff review, code-aware chat; code download as a zip | |
| Google Calendar (read-only OAuth, real events); voice input (Whisper) | |
| Encrypted secrets vault (AES-256-GCM); security check before Ship, enforced on the server | |
| Public live URL with real views, community gallery with Remix, team sharing with roles | |

Without an AI key, the AI steps switch to scripted answers; without sandboxes, Build uses the quick build. A demo never gets stuck.

## How it works

```
Browser ──REST/server actions──▶ Next.js on Vercel ──▶ Supabase (Postgres + RLS: projects, versions, usage ledger, build_runs)
   │                                   │
   │ iframe (running app)              ├─▶ Model gateway (lib/ai/gateway.ts) ─▶ Groq · Claude · OpenAI · Gemini
   └──────────────▶ Vercel Sandbox ◀───┘   build agent (lib/ai/builder.ts): write_file · read_file · list_files · run_build · finish
                    microVM: Vite + React, dev server on :3000
```

A real build: **Approve the plan → `startRealBuild`** creates a sandbox, writes the scaffold (themed UI kit + app shell) and installs dependencies → the browser calls **`buildStep`** repeatedly; each step is one model call plus its tool calls, with the job state in `build_runs` (so a reload resumes it) → **`finish`** re-runs the build, starts the dev server, saves the real files, a version and the checks that ran → Test → Ship.

## Tech
Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (`@supabase/ssr`) · Vercel Sandbox · Anthropic SDK · React Flow · Monaco · Vercel.

```
app/              routes: landing, login, onboarding, (app)/*, p/[id] workspace, preview/[id], live/[slug]
components/       workspace/ (stepper, chat, stage cards, code, sandbox preview), agents/, app-preview/, shell/
lib/ai/           gateway + model registry, planner (questions, plan, screens), build agent harness, agent chat, editor AI
lib/actions/      server actions: projects, workspace, build (sandbox), github, agents, app data, security, team…
lib/sandbox.ts    the only provider-specific sandbox code
lib/script/       quick build timeline + per-stack template code
supabase/         migrations 0001–0006 (schema, RLS, usage ledger, build runs)
```

## Run locally
1. Create a Supabase project and run `supabase/migrations/0001` → `0006` in order in the SQL editor.
2. In Supabase **Auth → URL configuration**, set Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to the redirect URLs. Enable the Email, Google and GitHub providers (GitHub needs the `repo` scope for pushing).
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SECRETS_KEY=...          # 32 random bytes, base64
   GROQ_API_KEY=...         # any of these enables the gateway; without one the AI steps use scripted answers
   ANTHROPIC_API_KEY=...    # optional
   OPENAI_API_KEY=...       # optional
   GEMINI_API_KEY=...       # optional
   ```
4. For real builds locally: `vercel link`, then put the `VERCEL_OIDC_TOKEN` from `vercel env pull` in `.env.development.local` (on Vercel it's automatic).
5. Run `npm install && npm run dev`. `npm run check` runs the logic self-checks.

## What I'd do next
A queue worker instead of the browser driving build steps, warm sandbox templates (snapshots) so builds skip `npm install`, deploying the sandbox build to real hosting with its own database, a GitHub App with webhooks for two-way sync, real OAuth for third-party tools through a connections service, and multiplayer editing.
