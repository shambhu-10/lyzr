import type { Plan } from "@/lib/types";

/**
 * Deterministic, explainable estimate — the model never makes up prices.
 * Calibrated on real metered builds (Oct 2026): planning ≈ $0.001, each screen ≈ $0.0015 of model + sandbox time,
 * each agent ≈ $0.0005; a 3-screen app took ~1.5 min in the sandbox.
 */
export function estimate(p: Pick<Plan, "screens" | "agents" | "connections">) {
  const credits = 0.003 + p.screens.length * 0.0015 + p.agents.length * 0.0005;
  const minutes = Math.max(1, Math.ceil(0.5 + p.screens.length * 0.4 + p.agents.length * 0.2));
  return { credits: Math.round(credits * 1000) / 1000, minutes };
}

/** Small amounts read better with more digits: $0.008, $0.12, $3.40. */
export const money = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
