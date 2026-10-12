/**
 * Credits are dollars: $20 on sign-up + admin-granted bonus (profiles.bonus_credits) − what was actually spent.
 * Spend is metered: every model call and sandbox minute is a row in usage_events (see lib/usage-log.ts).
 */
export const STARTING_CREDITS = 20;

export type Spend = { project_id: string | null; kind: string; cost: number; calls: number };

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Total spend, or one project's spend. */
export const spentOn = (rows: Spend[], projectId?: string) =>
  round(rows.filter((r) => projectId === undefined || r.project_id === projectId).reduce((a, r) => a + Number(r.cost), 0));

export const balance = (spent: number, bonus = 0) => Math.max(0, round(STARTING_CREDITS + Number(bonus || 0) - spent));
