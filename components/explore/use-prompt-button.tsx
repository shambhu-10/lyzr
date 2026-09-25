"use client";
import { useRouter } from "next/navigation";
import { savePendingPrompt } from "@/lib/pending-prompt";
import { Button } from "@/components/ui/button";

export function UsePromptButton({ prompt, label = "Use template", variant = "outline" }: { prompt: string; label?: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  return (
    <Button size="sm" variant={variant} onClick={() => { savePendingPrompt(prompt); router.push("/home"); }}>{label}</Button>
  );
}
