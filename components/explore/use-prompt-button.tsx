"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

function Submit({ label, variant }: { label: string; variant: "outline" | "default" }) {
  const { pending } = useFormStatus();
  return <Button size="sm" variant={variant} type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{label}</Button>;
}

/** One click: creates the project and jumps straight to a ready plan (no questions). */
export function UsePromptButton({ prompt, label = "Use template", variant = "outline" }: { prompt: string; label?: string; variant?: "outline" | "default" }) {
  return (
    <form action={createProject}>
      <input type="hidden" name="prompt" value={prompt} />
      <input type="hidden" name="template" value="1" />
      <Submit label={label} variant={variant} />
    </form>
  );
}
