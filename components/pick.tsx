"use client";
import { MODELS, SOON_MODELS } from "@/lib/catalog";
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

/** Model picker: Groq models are live; other providers are listed as "Soon" so people see what's coming. */
export function ModelPick({ value, onChange, disabled, className }: { value: string; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label="Model" className={cn("w-full", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Groq · available</SelectLabel>
          {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label.replace(" · Groq", "")}</SelectItem>)}
        </SelectGroup>
        {SOON_MODELS.map((g) => (
          <SelectGroup key={g.provider}>
            <SelectSeparator />
            <SelectLabel>{g.provider}</SelectLabel>
            {g.models.map((m) => (
              <SelectItem key={m} value={`soon:${m}`} disabled>
                <span className="flex w-full items-center justify-between gap-3">{m}<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span></span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
