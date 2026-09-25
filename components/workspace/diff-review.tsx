"use client";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Check, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), { ssr: false, loading: () => <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin" /></div> });

export type ProposedEdit = { path: string; original: string; modified: string; summary: string };

const lang = (p: string) => (p.endsWith(".py") ? "python" : p.endsWith(".sql") ? "sql" : p.endsWith(".md") ? "markdown" : "typescript");

/** Every AI code change is reviewed as a side-by-side diff before it touches the file. */
export function DiffReview({ edit, onAccept, onClose }: { edit: ProposedEdit | null; onAccept: (e: ProposedEdit) => void; onClose: () => void }) {
  const { resolvedTheme } = useTheme();
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[80vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{edit?.path}</DialogTitle>
          <DialogDescription>{edit?.summary || "Review the AI's change."}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          {edit && <DiffEditor original={edit.original} modified={edit.modified} language={lang(edit.path)} theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false }} />}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}><X /> Reject</Button>
          <Button onClick={() => edit && onAccept(edit)}><Check /> Accept change</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
