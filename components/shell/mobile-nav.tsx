"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Compass, FolderKanban, Home, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/home", icon: Home, label: "Home" },
  { href: "/projects", icon: FolderKanban, label: "Projects" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/connections", icon: Plug, label: "Connections" },
  { href: "/explore", icon: Compass, label: "Explore" },
];

export function MobileNav() {
  const path = usePathname();
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/95 py-2 backdrop-blur md:hidden" aria-label="Main">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={cn("flex flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground", path.startsWith(i.href) && "text-foreground")}>
            <i.icon className="size-5" />{i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
