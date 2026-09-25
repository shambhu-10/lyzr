export type Integration = { id: string; name: string; cat: string; scopes: string[]; color: string };

export const INTEGRATIONS: Integration[] = [
  { id: "google-calendar", name: "Google Calendar", cat: "Productivity", scopes: ["See your calendar events (read-only)"], color: "#4285F4" },
  { id: "gmail", name: "Gmail", cat: "Communication", scopes: ["Create email drafts", "Read message metadata"], color: "#EA4335" },
  { id: "google-drive", name: "Google Drive", cat: "Productivity", scopes: ["See files you choose"], color: "#0F9D58" },
  { id: "google-sheets", name: "Google Sheets", cat: "Data", scopes: ["Read and edit sheets you choose"], color: "#34A853" },
  { id: "slack", name: "Slack", cat: "Communication", scopes: ["Post messages to channels you pick"], color: "#611F69" },
  { id: "hubspot", name: "HubSpot", cat: "CRM", scopes: ["Read and update contacts & deals"], color: "#FF7A59" },
  { id: "notion", name: "Notion", cat: "Productivity", scopes: ["Read pages you share"], color: "#111111" },
  { id: "github", name: "GitHub", cat: "Developer", scopes: ["Read repositories", "Create branches and pull requests"], color: "#24292F" },
  { id: "linear", name: "Linear", cat: "Developer", scopes: ["Read and create issues"], color: "#5E6AD2" },
  { id: "salesforce", name: "Salesforce", cat: "CRM", scopes: ["Read and update records"], color: "#00A1E0" },
  { id: "microsoft-365", name: "Microsoft 365", cat: "Productivity", scopes: ["Read Outlook calendar", "Create Outlook drafts"], color: "#D83B01" },
  { id: "web-search", name: "Web search", cat: "Data", scopes: ["Search the public web"], color: "#0EA5E9" },
];

export const integrationById = (id: string) => INTEGRATIONS.find((i) => i.id === id);
