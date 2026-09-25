import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";

export const MODEL = "openai/gpt-oss-120b"; // Groq production model with strict structured outputs
export const CHAT_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
const client = process.env.GROQ_API_KEY ? new Groq() : null;
export const llmEnabled = !!client;

// USD per 1M tokens, from Groq's model pages (console.groq.com/docs/model/…). Unlisted models → cost unknown.
const PRICES: Record<string, { in: number; out: number }> = {
  "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-20b": { in: 0.075, out: 0.3 },
};

export type Usage = { model: string; input_tokens: number; output_tokens: number; ms: number; cost_usd: number | null };

function usageOf(model: string, u: { prompt_tokens?: number; completion_tokens?: number } | undefined, t0: number): Usage {
  const input_tokens = u?.prompt_tokens ?? 0;
  const output_tokens = u?.completion_tokens ?? 0;
  const p = PRICES[model];
  return { model, input_tokens, output_tokens, ms: Date.now() - t0, cost_usd: p ? (input_tokens * p.in + output_tokens * p.out) / 1e6 : null };
}

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

export async function structured<T extends z.ZodType>(schema: T, name: string, system: string, user: string, effort: "low" | "medium" = "medium"): Promise<{ data: z.infer<T>; usage: Usage } | null> {
  if (!client) return null;
  // Validate with zod; unwrap a one-element array (the model sometimes wraps the object).
  const accept = (raw: unknown) => { const r = schema.safeParse(Array.isArray(raw) && raw.length === 1 ? raw[0] : raw); return r.success ? r.data : null; };
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        reasoning_effort: effort,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema: toStrictSchema(schema) } },
      });
      const data = accept(JSON.parse(res.choices[0]?.message?.content ?? "null"));
      if (data) return { data, usage: usageOf(MODEL, res.usage, t0) };
      console.error(`llm ${name}: schema mismatch (attempt ${attempt + 1})`);
    } catch (e) {
      // Groq rejects output that doesn't match the schema but returns it as failed_generation — salvage it if zod accepts it.
      const failed = e instanceof Groq.APIError ? (e.error as { error?: { failed_generation?: string } } | undefined)?.error?.failed_generation : undefined;
      if (failed) { try { const data = accept(JSON.parse(failed)); if (data) return { data, usage: usageOf(MODEL, undefined, t0) }; } catch {} }
      console.error(`llm ${name} error (attempt ${attempt + 1})`, e instanceof Groq.APIError ? `${e.status} ${e.message.slice(0, 200)}` : e);
      if (e instanceof Groq.APIError && e.status !== 400 && e.status !== 429 && (e.status ?? 0) < 500) return null;
    }
  }
  return null;
}

export type Turn = { role: "user" | "assistant"; content: string };

/** null = no API key configured; undefined = the call failed. */
export async function chat(system: string, history: Turn[], model = MODEL): Promise<{ text: string; usage: Usage } | null | undefined> {
  if (!client) return null;
  const t0 = Date.now();
  const m = CHAT_MODELS.includes(model) ? model : MODEL;
  try {
    const res = await client.chat.completions.create({
      model: m,
      ...(m.startsWith("openai/") ? { reasoning_effort: "low" as const } : {}),
      messages: [{ role: "system", content: system }, ...history],
    });
    return { text: res.choices[0]?.message?.content ?? "", usage: usageOf(m, res.usage, t0) };
  } catch (e) {
    console.error("llm chat error", e instanceof Groq.APIError ? `${e.status} ${e.message}` : e);
    return undefined;
  }
}
