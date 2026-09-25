"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bot, Compass, CreditCard, FolderInput, FolderKanban, HelpCircle, Home, LogOut, Moon, Plug, Plus, Settings } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { listProjectsLite } from "@/lib/actions/projects";
import { createClient } from "@/lib/supabase/client";

const PAGES = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/explore", label: "Explore templates", icon: Compass },
  { href: "/import", label: "Import from GitHub", icon: FolderInput },
  { href: "/usage", label: "Usage & billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
];

/** ⌘K / Ctrl+K: jump to any page or project, or run a common action. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; stage: string }[]>([]);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) listProjectsLite().then(setProjects).catch(() => {}); }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump anywhere or run an action">
      <Command>
      <CommandInput placeholder="Search pages, projects, actions…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/home")}><Plus /> New project</CommandItem>
          <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); }}><Moon /> Toggle dark mode</CommandItem>
          <CommandItem onSelect={async () => { await createClient().auth.signOut(); go("/"); }}><LogOut /> Sign out</CommandItem>
        </CommandGroup>
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => <CommandItem key={p.id} value={`project ${p.name}`} onSelect={() => go(`/p/${p.id}`)}><FolderKanban /> {p.name}<CommandShortcut>{p.stage}</CommandShortcut></CommandItem>)}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {PAGES.map((p) => <CommandItem key={p.href} onSelect={() => go(p.href)}><p.icon /> {p.label}</CommandItem>)}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
