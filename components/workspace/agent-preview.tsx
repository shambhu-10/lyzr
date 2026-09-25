"use client";
import { useState } from "react";
import { Bot, Copy } from "lucide-react";
import { toast } from "sonner";
import { ChatWidget } from "@/components/agents/chat-widget";
import { chatWithAgent } from "@/lib/actions/agents";
import { slug as slugify } from "@/lib/script/files";
import type { AgentRow } from "@/lib/workspace-types";
import type { Plan } from "@/lib/types";
import { useOrigin } from "@/hooks/use-origin";
import { cn } from "@/lib/utils";

/** Preview for agent projects: the real agent in its chat widget, plus how to use it from anywhere. */
export function AgentPreview({ plan, agents, slug, live }: { plan: Plan; agents: AgentRow[]; slug: string; live: boolean }) {
  const origin = useOrigin();
  const agent = agents[0];
  const t = plan.trigger ?? { kind: "chat" as const, detail: "" };
  const [tab, setTab] = useState<"embed" | "api" | "schedule">(t.kind === "api" ? "api" : t.kind === "schedule" ? "schedule" : "embed");
  const id = slugify(plan.agents[0]?.name ?? "agent");
  // Embed = the real public page; API / schedule = the route in the generated code (app/api/agents/[agent]/route.ts).
  const snippets = {
    embed: `<iframe src="${origin}/live/${slug}" title="${plan.name}"\n  style="width:380px;height:560px;border:0;border-radius:16px"></iframe>`,
    api: `curl -X POST https://<your-app>/api/agents/${id} \\\n  -H "Content-Type: application/json" \\\n  -d '{"input": {"message": "${(plan.tests?.[0]?.input ?? "Hello").replace(/['"\\]/g, "")}"}}'`,
    schedule: `// vercel.json — ${t.kind === "schedule" ? t.detail : "every weekday at 08:00"}\n{ "crons": [{ "path": "/api/agents/${id}", "schedule": "0 8 * * 1-5" }] }`,
  };
  const note = { embed: live ? "Live now — paste it into any website." : "Works once you ship.", api: "Route from the generated code — works once you deploy the repo.", schedule: "Vercel Cron calls the generated route on a timer." }[tab];
  return (
    <div className="grid h-full gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {agent ? (
        <ChatWidget name={plan.name} tagline={plan.tagline} className="h-full min-h-[480px]"
          suggestions={(plan.tests ?? []).map((x) => x.input).slice(0, 3)}
          send={async (h) => (await chatWithAgent(agent.id, h.map(({ role, content }) => ({ role, content })))).text} />
      ) : (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed text-center text-sm text-muted-foreground"><div><Bot className="mx-auto mb-3 size-6" />Your agent&apos;s chat appears here once it&apos;s built.</div></div>
      )}
      <aside className="space-y-3">
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">Trigger</div>
          <div className="mt-1 text-sm font-medium capitalize">{t.kind}</div>
          <div className="text-xs text-muted-foreground">{t.detail}</div>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="flex gap-1 border-b p-1.5 text-xs">
            {(["embed", "api", "schedule"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-2.5 py-1 capitalize text-muted-foreground", tab === k && "bg-muted font-medium text-foreground")}>{k === "embed" ? "Embed" : k === "api" ? "API" : "Schedule"}</button>
            ))}
          </div>
          <div className="p-3">
            <pre className="overflow-x-auto rounded-lg bg-[oklch(0.18_0.01_260)] p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-[oklch(0.9_0_0)]">{snippets[tab]}</pre>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{note}{live && tab === "embed" && <> <a className="underline" href={`/live/${slug}`} target="_blank">Open</a></>}</span>
              <button onClick={() => { navigator.clipboard.writeText(snippets[tab]); toast("Copied"); }} className="flex items-center gap-1 hover:text-foreground"><Copy className="size-3" />Copy</button>
            </div>
          </div>
        </div>
        {!!plan.guardrails?.length && (
          <div className="rounded-xl border bg-card p-3 text-xs">
            <div className="font-medium text-muted-foreground">It will never</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{plan.guardrails.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
