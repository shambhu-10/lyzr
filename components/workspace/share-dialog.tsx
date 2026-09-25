"use client";
import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createInvite, listPeople, removeMember, type Person } from "@/lib/actions/team";
import type { Project } from "@/lib/types";
import { useOrigin } from "@/hooks/use-origin";

const ROLE = { owner: "Owner", editor: "Can edit", viewer: "Can view" } as const;

/** Real team sharing: invite links with a role, and the list of people on the project. */
export function ShareDialog({ project, name, open, onOpenChange, isOwner }: { project: Project; name: string; open: boolean; onOpenChange: (o: boolean) => void; isOwner: boolean }) {
  const origin = useOrigin();
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    listPeople(project.id).then((r) => ("error" in r ? setError(r.error ?? "Couldn't load people.") : setPeople(r.people))).catch(() => setError("Couldn't load people."));
  }, [open, project.id]);

  const invite = async () => {
    setBusy(true);
    const r = await createInvite(project.id, role).catch(() => ({ error: "Couldn't create the link." }));
    setBusy(false);
    if ("error" in r) return toast.error(r.error);
    const url = `${origin}/invite/${r.token}`;
    setLink(url);
    try { await navigator.clipboard.writeText(url); toast.success("Invite link copied — send it to your teammate"); } catch {}
  };
  const remove = async (p: Person) => {
    const r = await removeMember(project.id, p.user_id);
    if ("error" in r) return toast.error(r.error);
    setPeople((xs) => xs?.filter((x) => x.user_id !== p.user_id) ?? null);
    toast(`${p.name} was removed`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setLink(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Share “{name}”</DialogTitle><DialogDescription>Invite people to build with you. Editors can change the app; viewers can look and test.</DialogDescription></DialogHeader>
        {isOwner ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select value={role} onChange={(e) => { setRole(e.target.value as "editor" | "viewer"); setLink(null); }} aria-label="Role" className="h-9 min-w-32 flex-1 rounded-lg border bg-background px-2 text-sm">
                <option value="editor">Can edit</option><option value="viewer">Can view</option>
              </select>
              <Button onClick={invite} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />} Create invite link</Button>
            </div>
            {link && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-xs">
                <span className="flex-1 truncate font-mono">{link}</span>
                <Button size="icon-xs" variant="ghost" aria-label="Copy invite link" onClick={() => { navigator.clipboard.writeText(link); toast("Copied"); }}><Copy /></Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Links expire in 7 days. Anyone with the link can join with this role after signing in.</p>
          </div>
        ) : <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">Only the owner can invite people.</p>}

        <div>
          <div className="text-xs font-medium text-muted-foreground">People on this project</div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : !people ? <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" /> : (
            <ul className="mt-2 divide-y rounded-lg border">
              {people.map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 p-2 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{p.name[0]}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}{p.is_you && <span className="text-muted-foreground"> (you)</span>}</span>
                  <span className="text-xs text-muted-foreground">{ROLE[p.role]}</span>
                  {isOwner && p.role !== "owner" && <Button size="icon-xs" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}><UserMinus /></Button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
          <span className="flex-1 truncate font-mono">{origin}/live/{project.slug}</span>
          <Button size="xs" variant="outline" onClick={() => { navigator.clipboard.writeText(`${origin}/live/${project.slug}`); toast("Link copied"); }}>Copy public link</Button>
        </div>
        <p className="-mt-2 text-[11px] text-muted-foreground">{project.stage === "live" ? "Your live app — anyone with this link can use it." : "The public link works once the project is shipped to production."}</p>
      </DialogContent>
    </Dialog>
  );
}
