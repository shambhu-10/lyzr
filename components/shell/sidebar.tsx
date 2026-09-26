"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Compass, CreditCard, FolderKanban, HelpCircle, Home, Plug, Plus, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const MAIN = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/explore", label: "Explore", icon: Compass },
];
const FOOT = [
  { href: "/usage", label: "Usage & billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
];

export function Sidebar() {
  const path = usePathname();
  const item = (i: (typeof MAIN)[number]) => {
    const active = path === i.href || path.startsWith(i.href + "/");
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
        className={cn("relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
          active && "bg-sidebar-accent font-medium text-sidebar-foreground before:absolute before:inset-y-1.5 before:-left-2 before:w-0.5 before:rounded-full before:bg-brand")}>
        <i.icon className={cn("size-4", active && "text-brand")} />{i.label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <div className="px-1.5"><Logo href="/home" /></div>
      <Link href="/home" className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
        <Plus className="size-4" /> New project
      </Link>
      <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="mt-2 flex items-center justify-between rounded-lg border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        Search or jump to… <kbd className="rounded border px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <nav className="mt-4 space-y-0.5" aria-label="Main">{MAIN.map(item)}</nav>
      <div className="mt-auto space-y-0.5">
        {FOOT.map(item)}
      </div>
    </aside>
  );
}
