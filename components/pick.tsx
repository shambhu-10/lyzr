"use client";
import { useEffect, useState } from "react";
import { MODEL_REGISTRY, PROVIDER_LABEL, type Provider } from "@/lib/ai/models";
import { modelProviders } from "@/lib/actions/models";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Styled single-choice picker (replaces native <select>s). */
export function Pick<T extends string>({ value, onChange, options, disabled, label, className }: {
  value: T; onChange: (v: T) => void; options: readonly { id: T; label: string }[]; disabled?: boolean; label: string; className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger aria-label={label} className={cn("w-full", className)}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

let providers: Promise<Provider[]> | null = null; // fetched once per page load

/** Model picker over the gateway's registry: models whose provider has a key are selectable, the rest say "Add key". */
export function ModelPick({ value, onChange, disabled, className }: { value: string; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  const [enabled, setEnabled] = useState<Provider[] | null>(null);
  useEffect(() => { (providers ??= modelProviders()).then(setEnabled).catch(() => setEnabled([])); }, []);
  const groups = (Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => ({ p, models: MODEL_REGISTRY.filter((m) => m.provider === p) }));
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label="Model" className={cn("w-full", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        {groups.map(({ p, models }, i) => {
          const off = !!enabled && !enabled.includes(p);
          return (
            <SelectGroup key={p}>
              {i > 0 && <SelectSeparator />}
              <SelectLabel>{PROVIDER_LABEL[p]}</SelectLabel>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id} disabled={off}>
                  <span className="flex w-full items-center justify-between gap-3">{m.label}{off && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Add key</span>}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
