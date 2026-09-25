"use client";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Background, Controls, Handle, Position, ReactFlow, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, FileOutput, Play } from "lucide-react";
import type { Plan } from "@/lib/types";
import { frameworkLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Data = { label: string; sub?: string; kind: "trigger" | "agent" | "output"; clickable?: boolean };

function FlowNode({ data }: NodeProps<Node<Data>>) {
  const Icon = data.kind === "agent" ? Bot : data.kind === "trigger" ? Play : FileOutput;
  return (
    <div className={cn("min-w-40 rounded-xl border bg-card px-3 py-2.5 text-xs shadow-sm", data.kind === "agent" && "border-brand/40 ring-3 ring-brand/10", data.clickable && "cursor-pointer hover:border-brand")}>
      {data.kind !== "trigger" && <Handle type="target" position={Position.Left} className="!bg-brand" />}
      <div className="flex items-center gap-2 font-medium"><Icon className={cn("size-3.5", data.kind === "agent" ? "text-brand" : "text-muted-foreground")} />{data.label}</div>
      {data.sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{data.sub}</div>}
      {data.kind !== "output" && <Handle type="source" position={Position.Right} className="!bg-brand" />}
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

export function AgentCanvas({ plan, framework, built, onOpen }: { plan: Plan; framework: string; built: boolean; onOpen: (name: string) => void }) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = useMemo(() => {
    const n = plan.agents.length;
    const nodes: Node<Data>[] = [
      { id: "trigger", type: "flow", position: { x: 0, y: (n - 1) * 60 }, data: { kind: "trigger", label: plan.connections[0] ? `${plan.connections[0].name} event` : "User request", sub: "Trigger" } },
      ...plan.agents.map((a, i) => ({ id: `a${i}`, type: "flow", position: { x: 260, y: i * 120 }, data: { kind: "agent" as const, label: a.name, sub: `${frameworkLabel(framework)} · ${a.tools.join(", ") || "no tools"}`, clickable: true } })),
      { id: "out", type: "flow", position: { x: 540, y: (n - 1) * 60 }, data: { kind: "output", label: plan.screens[plan.screens.length - 1]?.name ?? "Result", sub: "Shown in app" } },
    ];
    const edges: Edge[] = plan.agents.flatMap((_, i) => [
      { id: `t${i}`, source: "trigger", target: `a${i}`, animated: true },
      { id: `o${i}`, source: `a${i}`, target: "out", animated: true },
    ]);
    return { nodes, edges };
  }, [plan, framework]);

  return (
    <div className="relative h-full min-h-[420px]">
      <div className="absolute top-3 left-3 z-10 rounded-lg border bg-background/90 px-3 py-2 text-xs backdrop-blur">
        {built ? "Click an agent to configure, test and trace it." : "Agents are created during Build. This is the planned design."}
      </div>
      <ReactFlow colorMode={resolvedTheme === "dark" ? "dark" : "light"} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.35 }} proOptions={{ hideAttribution: true }}
        nodesDraggable={false} onNodeClick={(_, node) => node.data.kind === "agent" && onOpen(node.data.label)}>
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
