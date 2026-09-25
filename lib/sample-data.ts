// Sample data used when a project runs in "Demo data" mode, and to ground agents in the playground.
export const SAMPLE_MEETING = {
  title: "Q4 Product Planning",
  organizer: "Maya Patel",
  when: "Wed, Sep 23 · 9:30–10:30 AM PT",
  description: "Align on Q4 priorities, review capacity, and agree which roadmap bets move forward to validation. Please review the linked planning notes before the session.",
  attendees: [
    { name: "Jordan Lee", email: "jordan.lee@example.com", status: "Accepted" },
    { name: "Amira Khan", email: "amira.khan@example.com", status: "Accepted" },
    { name: "Noah Smith", email: "noah.smith@example.com", status: "Awaiting response" },
    { name: "Priya Rao", email: "priya.rao@example.com", status: "Accepted" },
  ],
};

export const SAMPLE_AGENDA = [
  { time: "9:30", title: "Q4 Product Planning", who: "Maya Patel + 4", tag: "Planning" },
  { time: "11:00", title: "Design review: onboarding v2", who: "Luca Martin + 2", tag: "Review" },
  { time: "14:00", title: "Customer call — Northstar Co.", who: "Sam Chen", tag: "External" },
  { time: "16:30", title: "1:1 with Jordan", who: "Jordan Lee", tag: "1:1" },
];

export function sampleContext(prompt: string) {
  if (/meeting|calendar|brief/i.test(prompt)) return JSON.stringify({ upcoming: SAMPLE_AGENDA, selected_event: SAMPLE_MEETING });
  return JSON.stringify({ note: "Sample workspace data", records: [{ id: 1, title: "Example record A", status: "open" }, { id: 2, title: "Example record B", status: "done" }] });
}
