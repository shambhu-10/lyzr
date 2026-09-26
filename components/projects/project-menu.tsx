"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteProject } from "@/lib/actions/projects";

/** "⋯" on a project card you own: open it, open the live app, or delete it (with a clear confirmation). */
export function ProjectMenu({ id, name, liveSlug }: { id: string; name: string; liveSlug?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    const r = await deleteProject(id).catch(() => ({ error: "Couldn't delete the project." }));
    setBusy(false);
    if ("error" in r) return toast.error(r.error);
    setConfirm(false);
    toast.success(`Deleted “${name}”`);
    router.refresh();
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Actions for ${name}`}
          className="grid size-7 place-items-center rounded-md border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground data-[state=open]:text-foreground">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => router.push(`/p/${id}`)}>Open project</DropdownMenuItem>
          {liveSlug && <DropdownMenuItem onSelect={() => window.open(`/live/${liveSlug}`, "_blank")}><ExternalLink /> Open live app</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}><Trash2 /> Delete…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{name}”?</DialogTitle>
            <DialogDescription>This permanently removes the project — its chat, code, versions, saved data and agents{liveSlug ? ", and its live link will stop working" : ""}. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete project</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
