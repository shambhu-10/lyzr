"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CreditCard, DollarSign, Lock, RefreshCw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LOW = 15;

/** Credits pill: a yellow dot when the balance drops below $15; opens a panel with Top Up and Manage billing. */
export function CreditsMenu({ credits }: { credits: number }) {
  const router = useRouter();
  const [topUp, setTopUp] = useState(false);
  const low = credits < LOW;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Credits: $${credits.toFixed(2)}${low ? " (running low)" : ""}`}
          className="relative flex h-9 items-center gap-1 rounded-lg border bg-card px-2.5 text-sm font-medium tabular-nums transition hover:bg-muted">
          <DollarSign className="size-3.5 text-muted-foreground" />{credits.toFixed(2)}
          {low && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning ring-2 ring-background" aria-hidden />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Credits</span>
            <button onClick={() => router.refresh()} aria-label="Refresh balance" className="text-muted-foreground hover:text-foreground"><RefreshCw className="size-3.5" /></button>
          </div>
          <div className="space-y-2 p-3">
            {low && <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning-soft px-2 py-1 text-[11px] font-medium"><AlertCircle className="size-3.5 text-warning" /> Credits below ${LOW}</div>}
            <div className="text-center"><div className="text-xl font-semibold tabular-nums">{credits.toFixed(2)}</div><div className="text-xs text-muted-foreground">remaining</div></div>
            <Button size="sm" className="w-full" onClick={() => setTopUp(true)}><Zap /> Top Up</Button>
            <Button size="sm" variant="outline" className="w-full" asChild><Link href="/usage">Manage billing</Link></Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <TopUpDialog open={topUp} onOpenChange={setTopUp} />
    </>
  );
}

/** Demo checkout: payments aren't wired up, and it says so plainly. */
function TopUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [amount, setAmount] = useState(25);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Top up credits</DialogTitle><DialogDescription>Credits pay for AI during planning, building and agent runs. Unused credits never expire.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {[10, 25, 50].map((a) => (
            <button key={a} onClick={() => setAmount(a)} className={cn("rounded-xl border p-3 text-center transition", amount === a ? "border-brand bg-brand-soft/60 ring-3 ring-brand/15" : "hover:bg-muted")}>
              <div className="text-lg font-semibold">${a}</div><div className="text-[11px] text-muted-foreground">{a === 25 ? "Most popular" : a === 50 ? "+10% bonus" : "Starter"}</div>
            </button>
          ))}
        </div>
        <fieldset disabled className="space-y-2 opacity-70">
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground"><CreditCard className="size-4" /> Card number <span className="ml-auto font-mono">•••• •••• •••• ••••</span></label>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground"><span className="rounded-lg border px-3 py-2">MM / YY</span><span className="rounded-lg border px-3 py-2">CVC</span></div>
        </fieldset>
        <p className="flex items-start gap-2 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" /> Payments are coming soon — this is a preview and nothing is charged.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => toast("We'll be in touch — sales@architect.new")}>Talk to sales</Button>
          <Button disabled>Pay ${amount}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
