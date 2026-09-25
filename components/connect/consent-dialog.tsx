"use client";
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";
import type { Integration } from "@/lib/integrations";

/** Simulated OAuth consent — mirrors what the provider's real screen asks, so users know exactly what they grant. */
export function ConsentDialog({ integration, open, onOpenChange, onAllow }: { integration: Integration | null; open: boolean; onOpenChange: (o: boolean) => void; onAllow: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  if (!integration) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <LogoMark /><span className="text-muted-foreground">⇄</span>
            <span className="grid size-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: integration.color }}>{integration.name[0]}</span>
          </div>
          <DialogTitle>Connect {integration.name}</DialogTitle>
          <DialogDescription>Architect will be able to:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {integration.scopes.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{s}</li>)}
        </ul>
        <div className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-brand" />
          Tokens are encrypted in your workspace vault and never shown to the AI or in chat. Disconnect anytime from Connections.
        </div>
        <p className="text-[11px] text-muted-foreground">Prototype note: this consent step is simulated — no data leaves your account.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onAllow(); setBusy(false); onOpenChange(false); }}>
            {busy && <Loader2 className="animate-spin" />} Allow access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
