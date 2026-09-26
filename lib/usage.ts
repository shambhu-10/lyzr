import type { Plan, Stage } from "@/lib/types";

// ponytail: spend derived from project progress; real metering would sum per-call usage events.
export const STARTING_CREDITS = 20;
const ORDER: Stage[] = ["plan", "connect", "build", "test", "ship", "live"];
const SHARE = { plan: 0.12, build: 0.7, test: 0.1, ship: 0.08 } as const;

export function stageSpend(p: { stage: Stage; plan: Plan | null }) {
  const total = p.plan?.estimate.credits ?? 0.2;
  const reached = ORDER.indexOf(p.stage);
  // A stage is billed once it has finished: build when testing starts, test when shipping starts, ship when live.
  const finished = { plan: !!p.plan, build: reached >= ORDER.indexOf("test"), test: reached >= ORDER.indexOf("ship"), ship: p.stage === "live" };
  return (Object.keys(SHARE) as (keyof typeof SHARE)[])
    .filter((s) => finished[s])
    .map((s) => ({ stage: s, cost: Math.round(total * SHARE[s] * 100) / 100 }));
}

export const projectSpend = (p: { stage: Stage; plan: Plan | null }) => Math.round(stageSpend(p).reduce((a, x) => a + x.cost, 0) * 100) / 100;
/** $20 on sign-up + admin-granted bonus (profiles.bonus_credits) − what projects have spent. */
export const balance = (projects: { stage: Stage; plan: Plan | null }[], bonus = 0) => Math.max(0, STARTING_CREDITS + Number(bonus || 0) - projects.reduce((a, p) => a + projectSpend(p), 0));
