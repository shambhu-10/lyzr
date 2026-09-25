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

## What's real and what's simulated

| Real | Simulated (clearly labelled in the UI) |
|---|---|
| Sign-in with Google, GitHub and email magic link (Supabase) | Build timeline (steps, diffs, terminal) |
| Postgres with row-level security on every table | Permission screens for third-party tools |
| AI clarifying questions and structured plan (Groq · `openai/gpt-oss-120b`, strict JSON-schema outputs validated with zod) | Test results, deploy progress |
| Agent playground chat (Groq, uses the model chosen on the agent) | Traces, evals, visitor analytics |
| Projects, stage, chat history and Builder/Developer preference are saved | Secrets vault (values are discarded) |
| **Editable generated code**, saved to the database, with versions and restore | |
| Your real GitHub repo list on Import | |
| Public live URL (`/live/[slug]`) that renders the shipped app | |

Without a `GROQ_API_KEY`, the AI steps switch to scripted answers, so a demo never gets stuck.

## Tech
Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (`@supabase/ssr`) · Groq SDK · React Flow · Monaco · Vercel.

```
app/            routes: landing, login, onboarding, (app)/*, p/[id] workspace, live/[slug]
components/     workspace/ (stepper, chat, stage cards, code), agents/, app-preview/, shell/
lib/ai/         planner (questions + plan), agent chat, estimate
lib/actions/    server actions (projects, workspace, agents, import, connections)
lib/script/     simulated build timeline + per-framework code generation
supabase/       migrations/0001_init.sql (schema + RLS)
```

## Run locally
1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor.
2. In Supabase **Auth → URL configuration**, set Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to the redirect URLs. Enable the Email, Google and GitHub providers.
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   GROQ_API_KEY=...        # optional; without it the AI steps use scripted answers
   ```
4. Run `npm install && npm run dev`. Then `npm run check` runs the logic self-checks.

## What I'd do next
Real code generation streamed from the agent, real OAuth for third-party tools via a token vault, real metering in place of estimated spend, a CLI/MCP server so Cursor or Claude Code can drive an Architect project, and multiplayer editing.
