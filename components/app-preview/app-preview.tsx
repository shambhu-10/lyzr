"use client";
import { Fragment, useEffect, useState } from "react";
import { Bot, CalendarCheck, Check, Copy, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Block, Plan } from "@/lib/types";
import { runBlockAgent } from "@/lib/actions/agents";
import { calendarEvents, type CalendarItem } from "@/lib/actions/calendar";
import { RichText } from "@/components/rich-text";
import { CommentThread } from "./comment-thread";
import type { Comment } from "@/lib/actions/comments";
import { cn } from "@/lib/utils";
import { themeStyle } from "@/lib/theme";

type Item = Block["items"][number] & { description?: string; attendees?: string[] };
export type CommentTarget = { screen: string; target: string };
type Ctx = {
  screen: string; blocks: Block[]; selection: Item | null; calendar: CalendarItem[] | null | undefined; onPick: (i: Item) => void;
  form: Record<string, string>; setField: (k: string, v: string) => void; projectId?: string; slug?: string;
  si: number; edit?: (path: string, value: string) => void;
};

/** Plain text normally; in "Edit text" mode an inline editor (Enter saves, Esc cancels). */
function T({ v, path, ctx, className }: { v: string; path: string; ctx: Pick<Ctx, "si" | "edit">; className?: string }) {
  if (!ctx.edit) return <>{v}</>;
  const full = `s.${ctx.si}.${path}`;
  return (
    <span contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit text" spellCheck={false}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { e.currentTarget.textContent = v; e.currentTarget.blur(); }
        e.stopPropagation();
      }}
      onBlur={(e) => { const t = e.currentTarget.textContent?.trim() ?? ""; if (t && t !== v) ctx.edit?.(full, t); else e.currentTarget.textContent = v; }}
      className={cn("-mx-0.5 cursor-text rounded px-0.5 outline-1 outline-dashed outline-(--a)/50 hover:bg-(--a)/5 focus:bg-white focus:outline-2 focus:outline-solid focus:outline-(--a)", className)}>{v}</span>
  );
}

/**
 * Renders a generated app from its plan: each screen is a list of AI-generated blocks.
 * Used in the workspace preview (screens assemble as the build reveals them) and on /live/[slug].
 */
export function AppPreview({ plan, revealed, demo, building, projectId, slug, commenting, comments, onComment, onEditComment, onDeleteComment, still, editing, onEditText }: {
  plan: Plan; revealed: number; demo: boolean; building?: boolean; projectId?: string; slug?: string;
  /** Thumbnail mode: no data fetching. */ still?: boolean;
  /** "Edit text" mode: copy becomes directly editable. */ editing?: boolean; onEditText?: (path: string, value: string) => void;
  commenting?: boolean; comments?: Comment[]; onComment?: (t: CommentTarget, body: string) => void;
  onEditComment?: (id: string, body: string) => void; onDeleteComment?: (id: string) => void;
}) {
  const [screen, setScreen] = useState(0);
  const [selection, setSelection] = useState<Item | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[] | null | undefined>(undefined);
  const [form, setForm] = useState<Record<string, string>>({});
  const active = Math.min(screen, Math.max(0, revealed - 1));
  const s = plan.screens[active];
  const usesCalendar = plan.screens.some((x) => x.blocks?.some((b) => b.source === "google-calendar"));

  useEffect(() => {
    if (usesCalendar && revealed > 0 && !still) calendarEvents().then(setCalendar).catch(() => setCalendar(null));
  }, [usesCalendar, revealed, still]);

  const pick = (item: Item) => {
    setSelection(item);
    const next = plan.screens.findIndex((x, i) => i > active && x.blocks?.some((b) => b.source === "selection"));
    if (next !== -1 && next < revealed) setScreen(next);
  };
  const blocks = s ? (s.blocks?.length ? s.blocks : legacyBlocks(plan, active)) : [];
  const ctx: Ctx = { screen: s?.name ?? "", blocks, selection, calendar, onPick: pick, form, setField: (k, v) => setForm((f) => ({ ...f, [k]: v })), projectId, slug,
    si: active, edit: editing && s?.blocks?.length ? onEditText : undefined };

  return (
    <div style={themeStyle(plan.theme)} className="@container flex h-full min-h-[520px] overflow-hidden rounded-xl border bg-[#FBFAF7] text-[#1F2430] shadow-sm">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-black/5 bg-(--app-side) p-4 text-(--app-side-fg) @3xl:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-(--a) text-sm text-white">{plan.name[0]}</span>
          {plan.name}
        </div>
        <nav className="mt-6 space-y-1 text-sm">
          {plan.screens.map((x, i) => (
            <button key={x.name} disabled={i >= revealed} onClick={() => setScreen(i)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition", i === active ? "bg-(--a)/15 font-medium text-(--side-active)" : "text-(--app-side-fg)/60 hover:bg-(--app-side-fg)/5", i >= revealed && "opacity-40")}>
              {i >= revealed && building ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              {x.name}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 rounded-lg border border-(--app-side-fg)/10 bg-(--app-side-fg)/5 p-3 text-xs">
          {plan.agents.map((a) => <div key={a.name} className="flex items-center gap-2"><Bot className="size-3.5 text-(--a)" /><span className="truncate font-medium">{a.name}</span></div>)}
          <div className="flex items-center gap-1.5 text-[10px] tracking-wide text-(--a) uppercase"><span className="size-1.5 rounded-full bg-(--a)" /> Ready</div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {calendar ? (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-5 py-2 text-xs text-emerald-900"><CalendarCheck className="size-3.5" /> Live data — showing your real Google Calendar.</div>
        ) : demo && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900"><b>Demo data.</b> This app is showing sample data — connect your real accounts to go live.</div>
        )}
        <div className="flex gap-1 overflow-x-auto border-b border-black/5 bg-white px-3 py-2 @3xl:hidden">
          {plan.screens.map((x, i) => (
            <button key={x.name} disabled={i >= revealed} onClick={() => setScreen(i)}
              className={cn("rounded-full px-3 py-1 text-xs whitespace-nowrap", i === active ? "bg-(--a)/10 font-medium text-(--a-ink)" : "text-black/55", i >= revealed && "opacity-40")}>{x.name}</button>
          ))}
        </div>
        <div className="space-y-5 p-5 @3xl:p-8">
          {active >= revealed || !s ? <SkeletonScreen /> : (
            <>
              <header className="rise">
                <div className="text-[11px] font-medium tracking-[.14em] text-black/45 uppercase">{plan.name}</div>
                <h1 className="mt-1 font-(family-name:--app-font) text-4xl leading-tight"><T v={s.name} path="name" ctx={ctx} /></h1>
                <p className="mt-1 text-sm text-black/55"><T v={s.purpose} path="purpose" ctx={ctx} /></p>
              </header>
              {blocks.map((b, k) => (
                <Commentable key={`${active}-${k}-${b.title}`} on={!!commenting} thread={(comments ?? []).filter((c) => c.screen === s.name && c.target === b.title)}
                  onSave={(body) => onComment?.({ screen: s.name, target: b.title }, body)} onEdit={onEditComment} onDelete={onDeleteComment}>
                  <BlockView block={b} k={k} ctx={ctx} />
                </Commentable>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function legacyBlocks(plan: Plan, i: number): Block[] {
  const s = plan.screens[i];
  const base = { body: "", columns: [], rows: [], fields: [], action: "", agent: "", source: "static" as const };
  const out: Block[] = [];
  if (s.metrics?.length) out.push({ ...base, type: "stats", title: s.name, items: s.metrics.map((m) => ({ title: m.label, meta: m.value, badge: "" })) });
  out.push({ ...base, type: "list", title: s.purpose, items: (s.rows ?? []).map((r) => ({ ...r, badge: "" })) });
  const a = plan.agents[i % plan.agents.length];
  if (a) out.push({ ...base, type: "agent", title: a.name, body: a.role, agent: a.name, action: s.action || "Run agent", items: [] });
  return out;
}

function SkeletonScreen() {
  return (
    <div className="space-y-4" aria-label="Screen is being built">
      <div className="h-7 w-1/3 rounded shimmer" />
      <div className="h-4 w-1/2 rounded shimmer" />
      <div className="grid gap-4 @xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl shimmer" />)}</div>
      <div className="h-48 rounded-xl shimmer" />
    </div>
  );
}

function Commentable({ on, thread, onSave, onEdit, onDelete, children }: {
  on: boolean; thread: Comment[]; onSave: (body: string) => void; onEdit?: (id: string, body: string) => void; onDelete?: (id: string) => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className={cn("relative rounded-xl", on && "cursor-crosshair outline-2 outline-offset-4 outline-transparent hover:outline-dashed hover:outline-(--a)/60")}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("[data-comment-ui]")) return; // badge & thread handle their own clicks
        if (on && !open) { e.preventDefault(); e.stopPropagation(); setOpen(true); setViewing(false); }
      }}>
      {thread.length > 0 && (
        <button data-comment-ui type="button" onClick={(e) => { e.stopPropagation(); setViewing((v) => !v); }} aria-label={`${thread.length} comment${thread.length === 1 ? "" : "s"} — view`}
          className="absolute -top-2 -right-2 z-20 grid size-5 cursor-pointer place-items-center rounded-full bg-(--a) text-[10px] font-semibold text-white ring-2 ring-white hover:scale-110">{thread.length}</button>
      )}
      {viewing && thread.length > 0 && (
        <div data-comment-ui><CommentThread comments={thread} onClose={() => setViewing(false)} onEdit={(id, b) => onEdit?.(id, b)} onDelete={(id) => onDelete?.(id)} /></div>
      )}
      {children}
      {open && (
        <div className="relative z-20 mt-2 rounded-xl border border-black/10 bg-white p-3 shadow-lg">
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What should change here?" aria-label="Comment" className="w-full resize-none rounded-lg border border-black/10 p-2 text-sm outline-none focus:border-(--a)" />
          <div className="mt-2 flex justify-end gap-2 text-xs">
            <button onClick={() => { setOpen(false); setText(""); }} className="rounded-md px-2 py-1 text-black/55 hover:bg-black/5">Cancel</button>
            <button disabled={!text.trim()} onClick={() => { onSave(text.trim()); setOpen(false); setText(""); }} className="rounded-md bg-(--a) px-2.5 py-1 font-medium text-white disabled:opacity-40">Add comment</button>
          </div>
        </div>
      )}
    </div>
  );
}

const card = "rise rounded-xl border border-black/5 bg-white";

function BlockView({ block: b, k, ctx }: { block: Block; k: number; ctx: Ctx }) {
  const t = (field: "title" | "body" | "action", cls?: string) => <T v={b[field]} path={`b.${k}.${field}`} ctx={ctx} className={cls} />;
  const it = (j: number, field: "title" | "meta" | "badge") => <T v={b.items[j][field]} path={`b.${k}.items.${j}.${field}`} ctx={ctx} />;
  const Row = ctx.edit ? "div" : "button"; // a <button> can't host an inline text editor
  switch (b.type) {
    case "stats":
      return (
        <div className="rise grid gap-3 @xl:grid-cols-3">
          {b.items.slice(0, 3).map((m, j) => <div key={m.title} className="rounded-xl border border-black/5 bg-white p-4"><div className="text-xs text-black/50">{it(j, "title")}</div><div className="mt-1 text-2xl font-semibold">{it(j, "meta")}</div></div>)}
        </div>
      );
    case "list": {
      const live = b.source === "google-calendar" && ctx.calendar?.length ? ctx.calendar : null;
      const items: Item[] = live ?? b.items;
      return (
        <div className={card}>
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-2.5 text-sm font-medium">{t("title")}
            {b.source === "google-calendar" && <span className={cn("rounded-full px-2 py-0.5 text-[10px]", live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{live ? "Google Calendar" : "Sample"}</span>}
          </div>
          {items.length ? items.map((x, j) => (
            <Row key={x.title + x.meta} onClick={() => ctx.onPick(x)} className={cn("flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-black/[.02]", ctx.selection?.title === x.title && "bg-(--a)/5")}>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{live ? x.title : it(j, "title")}</span>{x.meta && <span className="block truncate text-xs text-black/50">{live ? x.meta : it(j, "meta")}</span>}</span>
              {x.badge && <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px]">{live ? x.badge : it(j, "badge")}</span>}
            </Row>
          )) : <p className="px-4 py-6 text-sm text-black/45">Nothing here yet.</p>}
        </div>
      );
    }
    case "table":
      return (
        <div className={cn(card, "overflow-x-auto")}>
          <div className="border-b border-black/5 px-4 py-2.5 text-sm font-medium">{t("title")}</div>
          <table className="w-full text-sm"><thead className="text-left text-xs text-black/45"><tr>{b.columns.map((c) => <th key={c} className="px-4 py-2 font-normal">{c}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i} className="border-t border-black/5">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}</tbody></table>
        </div>
      );
    case "detail": {
      const sel = ctx.selection;
      const pairs = b.source === "selection" && sel
        ? [{ title: "Selected", meta: sel.title }, ...(sel.meta ? [{ title: "Details", meta: sel.meta }] : []), ...(sel.attendees?.length ? [{ title: "People", meta: sel.attendees.slice(0, 5).join(", ") }] : [])]
        : b.items;
      return (
        <div className={cn(card, "p-5")}>
          <div className="text-[11px] tracking-wide text-black/45 uppercase">{t("title")}</div>
          {b.source === "selection" && !sel && <p className="mt-2 text-sm text-black/50">Pick an item on the previous screen first — showing an example.</p>}
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-sm">{pairs.map((p) => <Fragment key={p.title}><dt className="text-black/50">{p.title}</dt><dd>{p.meta}</dd></Fragment>)}</dl>
          {sel?.description && b.source === "selection" && <p className="mt-3 text-sm leading-relaxed text-black/65">{sel.description}</p>}
        </div>
      );
    }
    case "form":
      return (
        <div className={cn(card, "space-y-3 p-5")}>
          <div className="font-medium">{t("title")}</div>
          {b.fields.map((f, j) => (
            <label key={f.label} className="block space-y-1 text-sm"><span className="text-black/60"><T v={f.label} path={`b.${k}.fields.${j}.label`} ctx={ctx} /></span>
              {f.kind === "textarea" ? <textarea rows={3} placeholder={f.placeholder} value={ctx.form[f.label] ?? ""} onChange={(e) => ctx.setField(f.label, e.target.value)} className="w-full rounded-lg border border-black/10 p-2 outline-none focus:border-(--a)" />
                : f.kind === "file" ? <span className="flex items-center gap-2 rounded-lg border border-dashed border-black/15 p-3 text-xs text-black/50"><Upload className="size-4" />{f.placeholder || "Drop a file"}</span>
                : <input placeholder={f.placeholder} value={ctx.form[f.label] ?? ""} onChange={(e) => ctx.setField(f.label, e.target.value)} className="h-9 w-full rounded-lg border border-black/10 px-2 outline-none focus:border-(--a)" />}
            </label>
          ))}
          {b.action && <Row onClick={() => toast.success("Saved")} className="inline-block rounded-lg bg-(--a) px-3 py-1.5 text-sm font-medium text-white">{t("action", "outline-white/70 focus:bg-transparent")}</Row>}
        </div>
      );
    case "text":
      return <div className={cn(card, "p-5")}><div className="font-medium">{t("title")}</div><p className="mt-2 text-sm leading-relaxed text-black/65">{t("body")}</p></div>;
    case "agent":
      return <AgentBlock b={b} ctx={ctx} body={t("body")} action={ctx.edit ? t("action", "outline-white/70 focus:bg-transparent focus:text-black") : null} />;
  }
}

function AgentBlock({ b, ctx, body, action }: { b: Block; ctx: Ctx; body: React.ReactNode; action: React.ReactNode }) {
  const [result, setResult] = useState<{ text: string; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const canRun = !!(ctx.projectId || ctx.slug);
  const run = async () => {
    setBusy(true);
    const context = JSON.stringify({
      screen: ctx.screen,
      selectedItem: ctx.selection, // the real item the user picked — the task is about this
      userInput: ctx.form,
      ...(ctx.selection ? {} : { exampleScreenContent: ctx.blocks.filter((x) => x.type !== "agent").map((x) => ({ title: x.title, items: x.items.slice(0, 8), rows: x.rows.slice(0, 8) })) }),
    });
    try { setResult(await runBlockAgent({ projectId: ctx.projectId, slug: ctx.slug, agent: b.agent, task: `${b.action || "Run"}: ${b.body}`, context })); }
    catch { toast.error("The agent couldn't run. Try again."); }
    setBusy(false);
  };
  return (
    <div className="rise rounded-xl border border-(--a)/25 bg-(--a)/5 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-start gap-2"><Bot className="mt-0.5 size-4 shrink-0 text-(--a)" /><span><b>{b.agent || b.title}</b> — {body}</span></span>
        {action ? <span className="rounded-lg bg-(--a) px-3 py-1.5 text-xs font-medium text-white">{action}</span> : <button onClick={run} disabled={busy || !canRun} title={canRun ? undefined : "Available once built"} className="flex items-center gap-1.5 rounded-lg bg-(--a) px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}{b.action || "Run agent"}
        </button>}
      </div>
      {result && (
        <div className="mt-3 rounded-lg border border-black/5 bg-white p-3">
          <RichText text={result.text} className="space-y-1 text-sm leading-relaxed" />
          <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-[11px] text-black/45">
            <span className="flex items-center gap-1"><Check className="size-3 text-(--a)" />{result.live ? "Generated live · nothing was sent or saved" : "Offline demo reply"}</span>
            <button onClick={() => { navigator.clipboard.writeText(result.text); toast("Copied"); }} className="flex items-center gap-1 hover:text-black"><Copy className="size-3" />Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}
