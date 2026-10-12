import { generate } from "@/lib/ai/gateway";
import { MAX_STEPS, TOOLS, compact, runTool, scaffold, systemPrompt, type BuildEvent, type StepState } from "@/lib/ai/builder";
import { createSandbox, run, startPreview, writeFiles } from "@/lib/sandbox";
import type { Plan } from "@/lib/types";
const plan = { name: "Client Pulse", tagline: "Log client meetings and get an AI summary", summary: "", scope: [], data: ["meetings", "clients"], connections: [], estimate: { credits: 1, minutes: 5 },
  screens: [{ name: "Meetings", purpose: "List of recent client meetings with status" }, { name: "Log meeting", purpose: "Form to log a meeting's notes" }, { name: "Insights", purpose: "Stats and the AI summary of the week" }],
  agents: [{ name: "Summary Agent", role: "Summarises meeting notes into action items", tools: [] }], theme: { name: "Crisp Ops", why: "", accent: "indigo", radius: "sharp", font: "sans", sidebar: "dark" } } as Plan;
async function main() {
  const t0 = Date.now();
  const sb = await createSandbox();
  await writeFiles(sb, scaffold(plan));
  const inst = await run(sb, "npm", ["install", "--no-audit", "--no-fund"], 500);
  console.log("install", inst.ok, Math.round((Date.now() - t0) / 1000) + "s");
  const state: StepState = { history: [{ role: "user", content: "Build the app now." }], dirty: true };
  let tokens = 0, cost = 0;
  for (let step = 1; step <= MAX_STEPS && !state.done; step++) {
    const events: BuildEvent[] = [];
    try {
      const res = await generate({ system: systemPrompt(plan), messages: compact(state.history), tools: TOOLS, effort: "low", maxTokens: 4500 });
      tokens += res.usage.input_tokens + res.usage.output_tokens; cost += res.usage.cost_usd ?? 0;
      state.history.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls, raw: res.raw });
      for (const c of res.toolCalls) state.history.push({ role: "tool", toolCallId: c.id, content: await runTool(sb, c, state, events) });
      if (!res.toolCalls.length) state.history.push({ role: "user", content: "Use the tools: write the files, run_build, then finish." });
      console.log(`step ${step} [${res.usage.model} in=${res.usage.input_tokens} out=${res.usage.output_tokens} ${Math.round((Date.now() - t0) / 1000)}s]`, res.toolCalls.map((c) => c.name).join(","), JSON.stringify(events).slice(0, 300));
    } catch (e) { console.log(`step ${step} ERROR`, e instanceof Error ? e.message : e); }
  }
  console.log("done:", state.done, "tokens", tokens, "cost $" + cost.toFixed(4), Math.round((Date.now() - t0) / 1000) + "s");
  const p = await startPreview(sb);
  console.log("preview", p);
  console.log("SANDBOX_NAME", sb.name);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
