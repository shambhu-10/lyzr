"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Click-to-edit text. Enter (or blur) commits, Esc cancels. */
export function Editable({ value, onChange, editable, multiline, className, placeholder, label }: {
  value: string; onChange: (v: string) => void; editable: boolean; multiline?: boolean; className?: string; placeholder?: string; label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editable) return <span className={className}>{value || <span className="text-muted-foreground">{placeholder}</span>}</span>;
  if (!editing)
    return (
      <button type="button" aria-label={`Edit ${label}`} onClick={() => { setDraft(value); setEditing(true); }}
        className={cn("-mx-1 rounded px-1 text-left decoration-dashed decoration-foreground/25 underline-offset-4 transition hover:bg-brand-soft/60 hover:underline", className)}>
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    );
  const commit = () => { setEditing(false); if (draft.trim() !== value) onChange(draft.trim()); };
  const common = {
    ref, value: draft, "aria-label": label, placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); } },
    className: cn("w-full rounded-md border border-brand/40 bg-background px-1.5 py-0.5 outline-none ring-3 ring-brand/15", className),
  };
  return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
}

