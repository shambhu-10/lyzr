"use client";
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { Comment } from "@/lib/actions/comments";

/** Comments pinned to one part of the app: read, edit or delete them before sending to Architect. */
export function CommentThread({ comments, onEdit, onDelete, onClose }: {
  comments: Comment[]; onEdit: (id: string, body: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <div role="dialog" aria-label="Comments" className="absolute top-4 right-0 z-30 w-72 rounded-xl border border-black/10 bg-white p-3 text-left text-[#1F2430] shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-black/55">
        {comments.length} comment{comments.length === 1 ? "" : "s"} · not sent yet
        <button onClick={onClose} aria-label="Close comments" className="rounded p-0.5 hover:bg-black/5"><X className="size-3.5" /></button>
      </div>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-black/[.03] p-2 text-sm">
            {editing === c.id ? (
              <>
                <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} aria-label="Edit comment" className="w-full resize-none rounded-md border border-black/10 bg-white p-1.5 text-sm outline-none focus:border-[#139C8E]" />
                <div className="mt-1 flex justify-end gap-1 text-xs">
                  <button onClick={() => setEditing(null)} className="rounded px-2 py-0.5 text-black/55 hover:bg-black/5">Cancel</button>
                  <button disabled={!draft.trim()} onClick={() => { onEdit(c.id, draft.trim()); setEditing(null); }} className="flex items-center gap-1 rounded bg-[#139C8E] px-2 py-0.5 font-medium text-white disabled:opacity-40"><Check className="size-3" />Save</button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-wrap">{c.body}</p>
                <button onClick={() => { setEditing(c.id); setDraft(c.body); }} aria-label="Edit comment" className="rounded p-0.5 text-black/40 hover:bg-black/5 hover:text-black"><Pencil className="size-3.5" /></button>
                <button onClick={() => onDelete(c.id)} aria-label="Delete comment" className="rounded p-0.5 text-black/40 hover:bg-black/5 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
