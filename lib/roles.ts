export const ROLES = [
  { id: "product", label: "Product Management", hint: "Roadmaps, research, feedback", ideas: ["User feedback analyzer — saves ~12 hrs/week", "Roadmap prioritisation agent", "Competitive intel digest"] },
  { id: "sales", label: "Sales & Marketing", hint: "Leads, campaigns, content", ideas: ["Lead qualification agent for HubSpot", "Follow-up email drafter", "Campaign performance brief"] },
  { id: "analyst", label: "Analyst / Consultant", hint: "Research, models, reporting", ideas: ["Vendor comparison scorecard", "Market sizing calculator", "Earnings season dashboard"] },
  { id: "ops", label: "Operations, HR & Finance", hint: "Processes, hiring, budgets", ideas: ["Candidate screening assistant", "Invoice reconciliation agent", "Policy Q&A bot"] },
  { id: "founder", label: "Founder / Student", hint: "Ideas, MVPs, side projects", ideas: ["MVP landing page with waitlist", "Customer interview synthesizer", "Pitch deck feedback agent"] },
  { id: "developer", label: "Developer / Engineer", hint: "Code, agents, APIs", ideas: ["LangGraph research agent with chat UI", "Import my repo and add an AI feature", "Support triage agent on my API"] },
] as const;
export type RoleId = (typeof ROLES)[number]["id"];
export const roleById = (id?: string | null) => ROLES.find((r) => r.id === id) ?? ROLES[0];
