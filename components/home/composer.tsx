"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, Check, Code2, FolderInput, Loader2, Palette, Paperclip, Plus, Wand2, X } from "lucide-react";
import { VoiceButton } from "@/components/voice-button";
import { createProject } from "@/lib/actions/projects";
import { takePendingPrompt } from "@/lib/pending-prompt";
import { useTypedPlaceholder } from "@/hooks/use-typed-placeholder";
import { ACCENTS, THEME_PRESETS, type AppTheme } from "@/lib/theme";
import type { Mode } from "@/lib/types";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LensTip } from "@/components/lens-info";

// Alternates an app idea and an agent idea, so both kinds of project are obvious without tabs.
const EXAMPLES = [
  "An app where my team logs client meetings and gets an AI summary…",
  "An agent that triages my support inbox every morning and drafts replies…",
  "A hiring pipeline app with an AI that scores every new CV…",
  "An agent that watches HubSpot and pings the owner about hot leads…",
];
const STATIC = "Describe the app or agent you want to build…";

/**
 * One prompt box. The "+" menu holds everything optional (attach, import, a look, "build an agent");
 * if nobody picks "agent", Architect decides app vs agent from the prompt.
 */
export function Composer({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [lens, setLens] = useState<Mode>(mode);
  const [agent, setAgent] = useState(false);
  const [look, setLook] = useState<AppTheme | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder = useTypedPlaceholder(EXAMPLES, !prompt && !focused, STATIC);

  useEffect(() => {
    const p = takePendingPrompt();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage (external) after hydration
    if (p) setPrompt(p);
  }, []);

  return (
    <form action={createProject} className="w-full rounded-2xl border bg-card p-3 text-left shadow-[var(--shadow-lift)] focus-within:ring-3 focus-within:ring-ring/25">
      <input type="hidden" name="kind" value={agent ? "agent" : "auto"} />
      <input type="hidden" name="lens" value={lens} />
      {look && <input type="hidden" name="look" value={JSON.stringify(look)} />}
      <textarea ref={areaRef} name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={placeholder} aria-label="Describe what to build"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (prompt.trim()) e.currentTarget.form?.requestSubmit(); } }}
        className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground" />

      {(agent || look || file) && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1">
          {agent && <Chip icon={<Bot className="size-3" />} label="Agent project" onRemove={() => setAgent(false)} />}
          {look && <Chip icon={<span className="size-2.5 rounded-full" style={{ background: ACCENTS[look.accent][0] }} />} label={`Look: ${look.name}`} onRemove={() => setLook(null)} />}
          {file && <Chip icon={<Paperclip className="size-3" />} label={file} onRemove={() => setFile(null)} />}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options" className="grid size-8 place-items-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground data-[state=open]:bg-muted">
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}><Paperclip /> Attach a file or screenshot</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/import")}><FolderInput /> Import a codebase</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Palette /> Pick a look</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {THEME_PRESETS.map((t) => (
                    <DropdownMenuItem key={t.name} onSelect={() => setLook(t)} className="items-start">
                      <span className="mt-0.5 size-3 shrink-0 rounded-full" style={{ background: ACCENTS[t.accent][0] }} />
                      <span className="min-w-0"><span className="block">{t.name}</span><span className="block text-xs text-muted-foreground">{t.why}</span></span>
                      {look?.name === t.name && <Check className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={agent} onCheckedChange={(v) => setAgent(!!v)}>
                <span><span className="block">Build an agent</span><span className="block text-xs text-muted-foreground">No screens: runs from chat, API, a schedule or Slack</span></span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <VoiceButton onText={(t) => setPrompt((p) => (p ? `${p} ${t}` : t))} className="h-8 px-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="How Architect should talk to you">
            {([["builder", "Builder", Wand2], ["developer", "Developer", Code2]] as const).map(([m, label, Icon]) => (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button type="button" role="radio" aria-checked={lens === m} onClick={() => setLens(m)}
                    className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground", lens === m && (m === "developer" ? "bg-background font-medium text-dev shadow-sm" : "bg-background font-medium text-brand shadow-sm"))}>
                    <Icon className="size-3.5" /><span className="hidden sm:inline">{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><LensTip mode={m} /></TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Submit disabled={!prompt.trim()} />
        </div>
      </div>
    </form>
  );
}

function Chip({ icon, label, onRemove }: { icon: React.ReactNode; label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/60 py-0.5 pr-1 pl-2 text-xs">
      {icon}<span className="truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-3" /></button>
    </span>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-label="Start planning"
      className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
    </button>
  );
}
