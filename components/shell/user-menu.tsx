"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Profile avatar (top right): who you are, settings, billing, sign out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initials = (name || email).split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Your profile" className="grid size-9 place-items-center rounded-full border-2 border-brand/60 bg-brand-soft text-xs font-semibold text-brand transition hover:border-brand">
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{name || "You"}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings"><Settings /> Settings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/usage"><CreditCard /> Usage &amp; billing</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
