import type { Plan } from "@/lib/types";

// Deterministic, explainable estimate — the model never makes up prices.
export function estimate(p: Pick<Plan, "screens" | "agents" | "connections">) {
  const credits = 0.3 + p.screens.length * 0.32 + p.agents.length * 0.28 + p.connections.length * 0.05;
  const minutes = 4 + p.screens.length * 2 + p.agents.length * 2;
  return { credits: Math.round(credits * 100) / 100, minutes };
}
