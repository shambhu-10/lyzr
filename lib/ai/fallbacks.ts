import type { Block, Plan } from "@/lib/types";

/* ---------- offline fallbacks: the demo never dead-ends if the API is unavailable ---------- */

const isMeeting = (p: string) => /meeting|calendar|brief/i.test(p);
const blank: Omit<Block, "type" | "title"> = { body: "", items: [], columns: [], rows: [], fields: [], action: "", agent: "", source: "static" };

export function fallbackBlocks(plan: Plan, i: number): Block[] {
  const s = plan.screens[i];
  const agent = plan.agents[i % plan.agents.length]?.name ?? "";
  if (isMeeting(plan.name + plan.summary)) {
    if (i === 0) return [
      { ...blank, type: "stats", title: "Today", items: [{ title: "Meetings", meta: "4", badge: "" }, { title: "Need prep", meta: "2", badge: "" }, { title: "External", meta: "1", badge: "" }] },
      { ...blank, type: "list", title: "Upcoming meetings", source: plan.connections.some((c) => c.id === "google-calendar") ? "google-calendar" : "static", items: [
        { title: "Q4 Product Planning", meta: "9:30 · Maya Patel + 4", badge: "Planning" },
        { title: "Design review: onboarding v2", meta: "11:00 · Luca Martin + 2", badge: "Review" },
        { title: "Customer call — Northstar Co.", meta: "14:00 · Sam Chen", badge: "External" },
        { title: "1:1 with Jordan", meta: "16:30 · Jordan Lee", badge: "1:1" },
      ] },
    ];
    if (i === 1) return [
      { ...blank, type: "detail", title: "Meeting", source: "selection", items: [{ title: "Organizer", meta: "Maya Patel", badge: "" }, { title: "When", meta: "Wed 9:30–10:30", badge: "" }, { title: "Attendees", meta: "5 (1 unconfirmed)", badge: "" }] },
      { ...blank, type: "form", title: "Shape your brief", fields: [{ label: "What should the brief focus on?", kind: "textarea", placeholder: "e.g. capacity risks and decisions we need" }], action: "" },
      { ...blank, type: "agent", title: "Meeting brief", body: "Writes a one-page brief grounded only in this event and your focus.", agent, action: "Generate brief" },
    ];
    return [{ ...blank, type: "text", title: "Your brief", body: "Pick a meeting and generate a brief — it appears here, ready to copy. Nothing is saved or sent." }];
  }
  const blocks: Block[] = [];
  if (s.metrics?.length) blocks.push({ ...blank, type: "stats", title: s.name, items: s.metrics.map((m) => ({ title: m.label, meta: m.value, badge: "" })) });
  blocks.push({ ...blank, type: "list", title: s.purpose, items: (s.rows?.length ? s.rows : [{ title: "Example item", meta: "Just now" }]).map((r) => ({ ...r, badge: "" })) });
  if (agent) blocks.push({ ...blank, type: "agent", title: agent, body: plan.agents[i % plan.agents.length].role, agent, action: s.action || "Run agent" });
  return blocks;
}

export function fallbackQuestions(prompt: string) {
  if (isMeeting(prompt))
    return {
      intro: "A meeting assistant can combine your calendar, quick research and transcript-based follow-ups — with every email kept as a draft for your approval.",
      questions: [
        { id: "eco", text: "Which calendar and email should it use?", why: "Decides which accounts you connect before building.", multi: false, options: [{ label: "Google Workspace", hint: "Google Calendar + Gmail drafts" }, { label: "Microsoft 365", hint: "Outlook calendar + drafts" }] },
        { id: "features", text: "What should v1 include?", why: "Fewer features ship faster; the rest stays on your list.", multi: true, options: [{ label: "Meeting briefs", hint: "Agenda, attendees, context" }, { label: "Attendee research", hint: "Recent company & people news" }, { label: "Transcript follow-ups", hint: "Recap + action items + email draft" }] },
        { id: "data", text: "Should it remember past meetings?", multi: false, options: [{ label: "Yes, keep a history", hint: "Briefs and follow-ups saved" }, { label: "No, nothing stored", hint: "Each run is fresh" }] },
      ],
    };
  return {
    intro: "Here's how I understand your idea. A few quick choices will shape what I build first.",
    questions: [
      { id: "users", text: "Who will use it?", why: "Decides sign-in, sharing and how polished it needs to be.", multi: false, options: [{ label: "Just me", hint: "Personal tool" }, { label: "My team", hint: "Shared workspace with sign-in" }, { label: "Customers", hint: "Public-facing app" }] },
      { id: "ai", text: "What should the AI agent do?", multi: true, options: [{ label: "Analyse and summarise", hint: "Reads inputs, produces insights" }, { label: "Take actions", hint: "Updates tools — with your approval" }, { label: "Answer questions", hint: "Chat over your data" }] },
      { id: "data", text: "Should it save data between sessions?", multi: false, options: [{ label: "Yes", hint: "Records and history" }, { label: "No", hint: "Nothing stored" }] },
    ],
  };
}

export function fallbackPlan(prompt: string, current?: Plan | null, instruction?: string): Omit<Plan, "estimate"> {
  if (current) {
    const add = instruction?.replace(/^add back:?\s*/i, "") ?? "";
    return { ...current, scope: current.scope.map((s) => (add && s.item.toLowerCase() === add.toLowerCase() ? { ...s, status: "in", reason: "" } : s)) };
  }
  if (isMeeting(prompt))
    return {
      name: "Briefly",
      tagline: "Walk into every meeting prepared.",
      summary: "Briefly reads your upcoming Google Calendar events and writes a one-page brief for any meeting you pick — who's attending, why it matters, and what to ask. Follow-up emails are always drafts you approve.",
      scope: [
        { item: "Meeting briefs from your calendar", status: "in", reason: "" },
        { item: "Focus notes (e.g. “budget risks”)", status: "in", reason: "" },
        { item: "Attendee & company research", status: "later", reason: "Needs a web-search connection; easy to add next." },
        { item: "Follow-up emails from transcripts", status: "later", reason: "Needs Gmail drafts + transcript upload; planned for v2." },
      ],
      screens: [
        { name: "Agenda", purpose: "Today's and upcoming meetings in order" },
        { name: "Meeting context", purpose: "Verify event details and add a focus" },
        { name: "Brief", purpose: "The generated one-page brief, copyable by section" },
      ],
      agents: [{ name: "Meeting Brief Agent", role: "Turns a calendar event and your focus into a grounded brief", tools: ["Google Calendar"] }],
      data: [],
      connections: [{ id: "google-calendar", name: "Google Calendar", why: "to read your upcoming meetings (read-only)", kind: "oauth" }],
    };
  const title = prompt.split(/\s+/).slice(0, 3).join(" ");
  return {
    name: title.charAt(0).toUpperCase() + title.slice(1),
    tagline: "Your idea, as a working app.",
    summary: `A focused first version of: ${prompt}`,
    scope: [{ item: "Core workflow from your description", status: "in", reason: "" }, { item: "Team sharing & roles", status: "later", reason: "Add once the core flow is validated." }],
    screens: [{ name: "Dashboard", purpose: "Overview of everything in one place" }, { name: "Workspace", purpose: "Where the main task happens" }, { name: "Results", purpose: "Outputs from the AI agent" }],
    agents: [{ name: "Assistant Agent", role: "Does the core reasoning task described in your prompt", tools: [] }],
    data: ["Your records and results"],
    connections: [],
  };
}
