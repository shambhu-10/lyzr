"use client";
import { useState } from "react";
import { Clock, Sparkles } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { UsePromptButton } from "./use-prompt-button";

const HOURS = [12, 8, 10];

export function Consultant({ role }: { role: string }) {
  const [r, setR] = useState(role || "product");
  const current = ROLES.find((x) => x.id === r) ?? ROLES[0];
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-brand" /> AI Consultant</div>
        <p className="mt-2 text-sm text-muted-foreground">Not sure what to build? Pick the work you do and we&apos;ll suggest the highest-leverage ideas, with the time they typically save.</p>
        <div className="mt-4 space-y-1">
          {ROLES.map((x) => (
            <button key={x.id} onClick={() => setR(x.id)} className={cn("w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted", r === x.id && "bg-muted font-medium")}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-3">
        {current.ideas.map((idea, i) => (
          <div key={idea} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <div className="font-medium">{idea.split(" — ")[0]}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-brand"><Clock className="size-3.5" /> Typically saves ~{HOURS[i]} hrs/week</div>
            </div>
            <UsePromptButton prompt={`Build a ${idea.split(" — ")[0].toLowerCase()} for a ${current.label.toLowerCase()} team.`} label="Build this" />
          </div>
        ))}
      </div>
    </div>
  );
}
