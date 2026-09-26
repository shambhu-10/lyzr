"use client";
import { ChatWidget } from "./chat-widget";
import { runBlockAgent } from "@/lib/actions/agents";
import type { Plan } from "@/lib/types";

/** Chat for an agent project: public by slug once live (live_project()), or privately by project id in Preview. */
export function LiveAgent({ plan, slug, projectId }: { plan: Plan; slug?: string; projectId?: string }) {
  return (
    <ChatWidget name={plan.name} tagline={plan.tagline} className="h-[min(640px,calc(100vh-7rem))] w-full max-w-md"
      suggestions={(plan.tests ?? []).map((t) => t.input).slice(0, 3)}
      send={async (h) => {
        const last = h[h.length - 1].content;
        const r = await runBlockAgent({ slug, projectId, agent: plan.agents[0]?.name ?? "", task: last, context: JSON.stringify({ conversation: h.slice(0, -1).slice(-10) }) });
        return r.text;
      }} />
  );
}
