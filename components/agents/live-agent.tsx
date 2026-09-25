"use client";
import { ChatWidget } from "./chat-widget";
import { runBlockAgent } from "@/lib/actions/agents";
import type { Plan } from "@/lib/types";

/** Public chat for a shipped agent project. Runs through live_project() by slug, like agent buttons in live apps. */
export function LiveAgent({ plan, slug }: { plan: Plan; slug: string }) {
  return (
    <ChatWidget name={plan.name} tagline={plan.tagline} className="h-[min(640px,calc(100vh-7rem))] w-full max-w-md"
      suggestions={(plan.tests ?? []).map((t) => t.input).slice(0, 3)}
      send={async (h) => {
        const last = h[h.length - 1].content;
        const r = await runBlockAgent({ slug, agent: plan.agents[0]?.name ?? "", task: last, context: JSON.stringify({ conversation: h.slice(0, -1).slice(-10) }) });
        return r.text;
      }} />
  );
}
