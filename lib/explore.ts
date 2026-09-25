export const TEMPLATES = [
  { cat: "Sales", title: "Lead qualification agent", desc: "Scores every new HubSpot lead against your ICP and alerts the owner.", prompt: "Build a lead qualification agent that scores new HubSpot leads against our ICP (company size, industry, role seniority), writes the score back to the CRM, and posts hot leads to Slack.", tools: ["HubSpot", "Slack"] },
  { cat: "Productivity", title: "Meeting brief assistant", desc: "Preps a one-page brief for every meeting on your calendar.", prompt: "Build a meeting assistant agent that reviews my calendar, prepares briefing notes for upcoming meetings, and drafts follow-up emails based on meeting transcripts.", tools: ["Google Calendar", "Gmail"] },
  { cat: "Support", title: "Support ticket triage", desc: "Classifies, prioritises and drafts replies for incoming tickets.", prompt: "Build a support inbox that classifies incoming tickets by urgency and topic, drafts a reply for each using our help-center docs, and escalates angry customers to a human.", tools: ["Gmail", "Knowledge base"] },
  { cat: "Analysts", title: "Vendor comparison scorecard", desc: "Weighted criteria, side-by-side scores, exportable summary.", prompt: "Build a vendor comparison tool where I define evaluation criteria with custom weights, score each vendor, and get an AI-written recommendation summary I can export.", tools: [] },
  { cat: "HR", title: "Candidate screening assistant", desc: "Reads resumes, matches to the role, suggests interview questions.", prompt: "Build a candidate screening app that reads uploaded resumes, scores them against a job description, and suggests tailored interview questions for each candidate.", tools: ["Google Drive"] },
  { cat: "Developers", title: "LangGraph research agent", desc: "Multi-step web research agent with a streaming chat UI.", prompt: "Build a LangGraph research agent that plans search queries, reads sources, and writes a cited report, with a streaming chat UI and a trace view.", tools: ["Web search"] },
  { cat: "Marketing", title: "Content repurposing studio", desc: "Turns one blog post into LinkedIn, X and newsletter drafts.", prompt: "Build a content studio where I paste a blog post and an agent produces LinkedIn, X and newsletter versions in our brand voice, with approval before anything is posted.", tools: ["LinkedIn", "X"] },
  { cat: "Finance", title: "Invoice reconciliation agent", desc: "Matches invoices to payments and flags mismatches.", prompt: "Build an invoice reconciliation agent that matches uploaded invoices to bank transactions from a CSV, flags mismatches, and produces a monthly summary.", tools: ["Google Sheets"] },
] as const;

export const LEARN = [
  { title: "Your first app in 10 minutes", kind: "Tutorial", mins: 10 },
  { title: "Connecting real data: Google, Slack & API keys", kind: "Tutorial", mins: 8 },
  { title: "Builder vs Developer view — when to switch", kind: "Guide", mins: 5 },
  { title: "Bring your own LangGraph or CrewAI agent", kind: "Tutorial", mins: 12 },
  { title: "Guardrails: keeping agents safe with approvals", kind: "Guide", mins: 6 },
  { title: "From preview to production: shipping checklist", kind: "Guide", mins: 7 },
] as const;
