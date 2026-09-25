"use client";
import { useState } from "react";
import { Code2, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AgentBody } from "./agent-drawer";
import { frameworkLabel } from "@/lib/catalog";
import type { AgentRow } from "@/lib/workspace-types";
import type { Mode } from "@/lib/types";

export function AgentDetail({ agent, defaultMode }: { agent: AgentRow; defaultMode: Mode }) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <p className="text-sm text-muted-foreground">{agent.role} · {frameworkLabel(agent.framework)}</p>
        </div>
        <label className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          {mode === "developer" ? <Code2 className="size-3.5 text-dev" /> : <Wand2 className="size-3.5 text-brand" />}{mode === "developer" ? "Developer" : "Builder"}
          <Switch checked={mode === "developer"} onCheckedChange={(v) => setMode(v ? "developer" : "builder")} className="scale-75" aria-label="Developer view" />
        </label>
      </div>
      <div className="mx-6 mb-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card md:mx-10">
        <AgentBody key={mode} agent={agent} mode={mode} />
      </div>
    </div>
  );
}
