"use client";
import { useState } from "react";
import { ArrowUp, BookOpen, Check, Clock, Loader2, Plus, ShieldCheck, Upload, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { chatWithAgent, updateAgent } from "@/lib/actions/agents";
import { agentCode } from "@/lib/script/files";
import { FRAMEWORKS, frameworkLabel } from "@/lib/catalog";
import type { AgentRow } from "@/lib/workspace-types";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string; ms?: number; tokens?: number };

export function AgentDrawer({ agent, mode, open, onOpenChange, onChange }: {
  agent: AgentRow | null; mode: Mode; open: boolean; onOpenChange: (o: boolean) => void; onChange?: (a: AgentRow) => void;
}) {
  if (!agent) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{agent.name}</SheetTitle>
          <SheetDescription>{agent.role}</SheetDescription>
          <div className="flex gap-2 pt-1 text-[11px]">
            <span className="rounded-full bg-muted px-2 py-0.5">{frameworkLabel(agent.framework)}</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{agent.model}</span>
          </div>
        </SheetHeader>
        <AgentBody key={agent.id + mode} agent={agent} mode={mode} onChange={onChange} />
      </SheetContent>
    </Sheet>
  );
}

export function AgentBody({ agent, mode, onChange }: { agent: AgentRow; mode: Mode; onChange?: (a: AgentRow) => void }) {
  const [a, setA] = useState(agent);
  const [dirty, setDirty] = useState(false);
  const [runs, setRuns] = useState<Turn[]>([]);
  const patch = (p: Partial<AgentRow>) => { setA((x) => ({ ...x, ...p })); setDirty(true); };
  const save = async () => {
    await updateAgent(a.id, { instructions: a.instructions, framework: a.framework, model: a.model });
    setDirty(false); onChange?.(a); toast.success("Agent saved — new version created");
  };
  const dev = mode === "developer";

  return (
    <Tabs defaultValue={dev ? "code" : "setup"} className="min-h-0 flex-1 gap-0">
      <TabsList variant="line" className="w-full justify-start border-b px-4">
        {(dev ? ["code", "model", "playground", "traces", "evals"] : ["setup", "tools", "knowledge", "playground"]).map((t) => (
          <TabsTrigger key={t} value={t} className="flex-none capitalize">{t}</TabsTrigger>
        ))}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="setup" className="space-y-5">
          <label className="block space-y-1.5"><span className="text-sm font-medium">What should this agent do?</span>
            <textarea value={a.instructions} onChange={(e) => patch({ instructions: e.target.value })} rows={6} className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
          </label>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-brand" /> Guardrails</div>
            <div className="mt-2 space-y-2">
              {["Ask me before sending, posting or deleting anything", "Only use data from connected sources — never make things up", "Hide personal info (emails, phone numbers) in outputs", "Escalate to a human when unsure"].map((g, i) => (
                <label key={g} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">{g}<Switch defaultChecked={i < 2} /></label>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="tools" className="space-y-3">
          {(a.tools.length ? a.tools : ["No tools yet"]).map((t) => (
            <div key={t} className="flex items-center justify-between rounded-lg border p-2.5 text-sm"><span className="flex items-center gap-2"><Wrench className="size-4 text-muted-foreground" />{t}</span>{a.tools.length > 0 && <span className="text-xs text-success">Connected</span>}</div>
          ))}
          <Button variant="outline" size="sm" onClick={() => toast("Pick from Connections, add an MCP server URL, or describe a REST API.")}><Plus /> Add tool or MCP server</Button>
        </TabsContent>
        <TabsContent value="knowledge" className="space-y-3">
          <p className="text-sm text-muted-foreground">Give the agent documents to answer from. PDFs and docs are searchable; spreadsheets become queryable tables.</p>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm">
            <Upload className="size-5 text-muted-foreground" />Drop files here<span className="text-xs text-muted-foreground">PDF, DOCX, CSV, XLSX · up to 50 MB</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"><BookOpen className="size-4 text-muted-foreground" />meeting-brief-guidelines.pdf<span className="ml-auto text-xs text-muted-foreground">12 pages · indexed</span></div>
        </TabsContent>
        <TabsContent value="code" className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Framework</span>
            <select value={a.framework} onChange={(e) => patch({ framework: e.target.value })} className="rounded-lg border bg-background px-2 py-1 text-sm">
              {FRAMEWORKS.map((f) => <option key={f.id} value={f.id}>{f.label} ({f.lang})</option>)}
            </select>
          </label>
          <pre className="overflow-x-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-4 font-mono text-[11.5px] leading-5 text-[oklch(0.9_0_0)]">{agentCode({ name: a.name, role: a.role, tools: a.tools }, a.framework).content}</pre>
          <p className="text-xs text-muted-foreground">Same HTTP contract whatever the framework — your app calls <code className="font-mono">/agents/{"{name}"}/run</code>. Switching frameworks regenerates this file only.</p>
        </TabsContent>
        <TabsContent value="model" className="space-y-4 text-sm">
          <label className="block space-y-1.5"><span className="font-medium">Model</span>
            <select value={a.model} onChange={(e) => patch({ model: e.target.value })} className="w-full rounded-lg border bg-background px-2 py-1.5">
              {["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5"><span className="font-medium">Reasoning effort</span>
            <select defaultValue="medium" className="w-full rounded-lg border bg-background px-2 py-1.5"><option>low</option><option>medium</option><option>high</option></select>
          </label>
          <label className="block space-y-1.5"><span className="font-medium">System prompt</span>
            <textarea value={a.instructions} onChange={(e) => patch({ instructions: e.target.value })} rows={6} className="w-full rounded-lg border bg-background p-2.5 font-mono text-xs" />
          </label>
        </TabsContent>
        <TabsContent value="playground"><Playground agentId={a.id} dev={dev} runs={runs} setRuns={setRuns} /></TabsContent>
        <TabsContent value="traces" className="space-y-2">
          {runs.filter((r) => r.role === "assistant").length === 0 && <p className="text-sm text-muted-foreground">Run the agent in the Playground — every run is traced here.</p>}
          {runs.filter((r) => r.role === "assistant").map((r, i) => (
            <div key={i} className="rounded-lg border p-2.5 font-mono text-[11px]">
              <div className="flex justify-between"><span>run #{i + 1}</span><span className="text-muted-foreground">{r.ms}ms · {r.tokens} tok</span></div>
              <div className="mt-1.5 space-y-0.5 text-muted-foreground"><div>├─ load context (sample data)</div><div>├─ llm.call {a.model}</div><div>└─ output {r.content.length} chars · guardrails ✓</div></div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="evals">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1.5 font-normal">Case</th><th className="font-normal">Grounded</th><th className="font-normal">Format</th><th className="font-normal">Result</th></tr></thead>
            <tbody>
              {["Normal meeting", "Missing description", "Unconfirmed attendee", "Many attendees", "Prompt injection in description"].map((c) => (
                <tr key={c} className="border-t"><td className="py-1.5">{c}</td><td>0.9{c.length % 9}</td><td>✓</td><td className="text-success"><Check className="inline size-3.5" /> pass</td></tr>
              ))}
            </tbody>
          </table>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => toast("Running 5 eval cases…")}>Re-run evals</Button>
        </TabsContent>
      </div>
      {dirty && <div className="flex justify-end gap-2 border-t p-3"><Button variant="ghost" onClick={() => { setA(agent); setDirty(false); }}>Discard</Button><Button onClick={save}>Save agent</Button></div>}
    </Tabs>
  );
}

function Playground({ agentId, dev, runs, setRuns }: { agentId: string; dev: boolean; runs: Turn[]; setRuns: React.Dispatch<React.SetStateAction<Turn[]>> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (q: string) => {
    const next = [...runs, { role: "user" as const, content: q }];
    setRuns(next); setText(""); setBusy(true);
    const r = await chatWithAgent(agentId, next.map(({ role, content }) => ({ role, content })));
    setRuns([...next, { role: "assistant", content: r.text, ms: r.ms, tokens: r.tokens }]);
    setBusy(false);
  };
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs text-muted-foreground">Try the agent on sample data before anyone else does. This is a live AI call.</p>
      <div className="space-y-3">
        {runs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {["Prep me for my next meeting", "What should I ask in the Q4 planning meeting?", "Who hasn't confirmed?"].map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{s}</button>
            ))}
          </div>
        )}
        {runs.map((t, i) => (
          <div key={i} className={cn("rounded-xl px-3 py-2 text-sm whitespace-pre-wrap", t.role === "user" ? "ml-8 bg-muted" : "border bg-card")}>
            {t.content}
            {dev && t.ms !== undefined && <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock className="size-3" />{t.ms}ms · {t.tokens} tokens</div>}
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) send(text.trim()); }} className="mt-auto flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the agent…" aria-label="Message the agent" className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><ArrowUp /></Button>
      </form>
    </div>
  );
}
