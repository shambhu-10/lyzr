import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";

export const MODEL = "openai/gpt-oss-120b"; // Groq production model with strict structured outputs
export const CHAT_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
const client = process.env.GROQ_API_KEY ? new Groq() : null;
export const llmEnabled = !!client;

/** JSON schema Groq strict mode accepts: drop keywords it may not support (zod still validates the result). */
function toStrictSchema(schema: z.ZodType) {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) if (!["$schema", "minItems", "maxItems"].includes(k)) out[k] = strip(v);
      return out;
    }
    return node;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export async function structured<T extends z.ZodType>(schema: T, name: string, system: string, user: string, effort: "low" | "medium" = "medium"): Promise<z.infer<T> | null> {
  if (!client) return null;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      reasoning_effort: effort,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema: toStrictSchema(schema) } },
    });
    const parsed = schema.safeParse(JSON.parse(res.choices[0]?.message?.content ?? "null"));
    if (!parsed.success) console.error(`llm ${name}: schema mismatch`, parsed.error.issues.slice(0, 3));
    return parsed.success ? parsed.data : null;
  } catch (e) {
    console.error(`llm ${name} error`, e instanceof Groq.APIError ? `${e.status} ${e.message}` : e);
    return null;
  }
}

export type Turn = { role: "user" | "assistant"; content: string };

export async function chat(system: string, history: Turn[], model = MODEL) {
  if (!client) return null;
  const t0 = Date.now();
  try {
    const m = CHAT_MODELS.includes(model) ? model : MODEL;
    const res = await client.chat.completions.create({
      model: m,
      ...(m.startsWith("openai/") ? { reasoning_effort: "low" as const } : {}),
      messages: [{ role: "system", content: system }, ...history],
    });
    return { text: res.choices[0]?.message?.content ?? "", ms: Date.now() - t0, tokens: res.usage?.total_tokens ?? 0 };
  } catch (e) {
    console.error("llm chat error", e instanceof Groq.APIError ? `${e.status} ${e.message}` : e);
    return undefined;
  }
}
