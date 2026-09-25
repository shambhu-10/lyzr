import { createClient } from "@/lib/supabase/server";
import { codeChat, complete, editSelection } from "@/lib/ai/code";
import { logUsage } from "@/lib/usage-log";

type Body =
  | { op: "complete"; projectId: string; path: string; prefix: string; suffix: string }
  | { op: "edit"; projectId: string; path: string; file: string; selection: string; instruction: string }
  | { op: "chat"; projectId: string; path: string; file: string; files: string[]; question: string };

/** Editor AI (autocomplete, ⌘K edit, code chat) for signed-in owners of the project. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });
  const body = (await req.json()) as Body;
  const { data: project } = await supabase.from("projects").select("id").eq("id", body.projectId).single(); // RLS: only the owner's project
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  if (body.op === "complete") {
    const r = await complete(body.path, String(body.prefix).slice(-6000), String(body.suffix).slice(0, 2000));
    await logUsage(supabase, project.id, "autocomplete", [r.usage]);
    return Response.json({ text: r.text });
  }
  if (body.op === "edit") {
    const r = await editSelection(body.path, body.file, body.selection.slice(0, 8000), body.instruction.slice(0, 500));
    if (!r) return Response.json({ error: "The AI couldn't make that edit — try rephrasing." }, { status: 502 });
    await logUsage(supabase, project.id, "code-edit", [r.usage]);
    return Response.json({ code: r.code, summary: r.summary });
  }
  const r = await codeChat(body.path, body.file, body.files.slice(0, 80), body.question.slice(0, 2000));
  if (!r) return Response.json({ error: "The AI didn't answer — please try again." }, { status: 502 });
  await logUsage(supabase, project.id, "code-chat", [r.usage]);
  // Never let the chat claim a change it didn't produce.
  if (r.edit.needed && !r.edit.content.trim()) return Response.json({ answer: "I understood that as a change request but didn't produce the edit — please ask again, or select the code and press ⌘K.", edit: null });
  return Response.json({ answer: r.answer, edit: r.edit.needed ? { content: r.edit.content, summary: r.edit.summary } : null });
}
