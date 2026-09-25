"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const initials = (name || email).split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-sidebar-accent">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initials}</span>
        <span className="min-w-0"><span className="block truncate font-medium">{name || "You"}</span><span className="block truncate text-xs text-muted-foreground">{email}</span></span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light" : "Dark"} appearance
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
