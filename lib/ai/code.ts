import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import { structured, type Usage } from "./llm";

const FAST = "openai/gpt-oss-20b"; // completions need speed more than depth
const client = process.env.GROQ_API_KEY ? new Groq() : null;
const PRICE = { in: 0.075, out: 0.3 };

const stripFences = (s: string) => s.replace(/^```[\w-]*\n?/, "").replace(/\n?```\s*$/, "");

/** Ghost-text completion at the cursor: returns only the text to insert (may be empty). */
export async function complete(path: string, prefix: string, suffix: string): Promise<{ text: string; usage: Usage | null }> {
  if (!client) return { text: "", usage: null };
  const t0 = Date.now();
  try {
    const res = await client.chat.completions.create({
      model: FAST,
      reasoning_effort: "low",
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: "You are a code completion engine. Output ONLY the characters to insert at <CURSOR>, continuing exactly from the last character before it — never repeat any text that appears before <CURSOR> (for example if the line is `const hours = ` output only the expression). No explanations, no markdown fences. Complete the current statement or block (at most ~8 lines). If nothing useful fits, output nothing." },
        { role: "user", content: `File: ${path}\n\n${prefix.slice(-3000)}<CURSOR>${suffix.slice(0, 1000)}` },
      ],
    });
    const u = res.usage;
    return {
      text: stripFences(res.choices[0]?.message?.content ?? "").replace(/<CURSOR>/g, ""),
      usage: { model: FAST, input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0, ms: Date.now() - t0, cost_usd: ((u?.prompt_tokens ?? 0) * PRICE.in + (u?.completion_tokens ?? 0) * PRICE.out) / 1e6 },
    };
  } catch (e) {
    console.error("complete error", e instanceof Groq.APIError ? `${e.status} ${e.message}` : e);
    return { text: "", usage: null };
  }
}

const EditSchema = z.object({ code: z.string().describe("The full replacement for the selected code, same language and indentation"), summary: z.string().describe("One short sentence describing the change") });

/** ⌘K: rewrite the selected code according to an instruction. */
export async function editSelection(path: string, file: string, selection: string, instruction: string) {
  const r = await structured(EditSchema, "code_edit", "You are a careful senior engineer editing code in place. Change only what the instruction asks; keep style, names and indentation consistent with the file.",
    `File: ${path}\n\n\`\`\`\n${file.slice(0, 12000)}\n\`\`\`\n\nSelected code to replace:\n\`\`\`\n${selection}\n\`\`\`\n\nInstruction: ${instruction}`, "low");
  return r ? { code: stripFences(r.data.code), summary: r.data.summary, usage: r.usage } : null;
}

const ChatSchema = z.object({
  answer: z.string().describe("Short markdown. For a change request, describe the PROPOSED change ('Here's a change that…') — never claim it is already applied; the user reviews it first."),
  edit: z.object({
    needed: z.boolean().describe("true whenever the user asks to add, change, fix, refactor or remove code"),
    content: z.string().describe("If needed: the COMPLETE new content of the open file with the change applied (not a snippet); else empty"),
    summary: z.string(),
  }),
});

/** Code-aware chat about the open file (with the project's file list as context). */
export async function codeChat(path: string, file: string, fileList: string[], question: string) {
  const r = await structured(ChatSchema, "code_chat", "You are an AI pair programmer inside an IDE. Be concise and concrete. When asked to change code, always return the full edited file in edit.content.",
    `Project files: ${fileList.join(", ")}\n\nOpen file: ${path}\n\`\`\`\n${file.slice(0, 14000)}\n\`\`\`\n\nQuestion: ${question}`, "low");
  return r ? { ...r.data, edit: { ...r.data.edit, content: stripFences(r.data.edit.content) }, usage: r.usage } : null;
}
