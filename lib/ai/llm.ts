import "server-only";
import { z } from "zod";
import { DEFAULT_MODEL } from "./models";
import { GatewayError, generate, llmEnabled, type Usage } from "./gateway";

export { llmEnabled };
export type { Usage };

/** JSON schema strict modes accept: drop keywords some providers reject (zod still validates the result). */
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

/** Ask for JSON matching a zod schema. Validated, retried once, salvaged from a rejected-but-valid reply; null → caller falls back. */
export async function structured<T extends z.ZodType>(schema: T, name: string, system: string, user: string, effort: "low" | "medium" = "medium"): Promise<{ data: z.infer<T>; usage: Usage } | null> {
  if (!llmEnabled) return null;
  // Unwrap a one-element array (models sometimes wrap the object).
  const accept = (raw: unknown) => { const r = schema.safeParse(Array.isArray(raw) && raw.length === 1 ? raw[0] : raw); return r.success ? r.data : null; };
  const json = { name, schema: toStrictSchema(schema) };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generate({ model: DEFAULT_MODEL, system, messages: [{ role: "user", content: user }], json, effort });
      const data = accept(JSON.parse(r.text || "null"));
      if (data) return { data, usage: r.usage };
      console.error(`llm ${name}: schema mismatch (attempt ${attempt + 1})`);
    } catch (e) {
      // Strict mode can reject output yet return it (Groq's failed_generation): keep it if zod accepts it.
      if (e instanceof GatewayError && e.partial) { try { const data = accept(JSON.parse(e.partial)); if (data) return { data, usage: { model: DEFAULT_MODEL, input_tokens: 0, output_tokens: 0, ms: 0, cost_usd: null } }; } catch {} }
      console.error(`llm ${name} error (attempt ${attempt + 1})`, e instanceof Error ? e.message : e);
      if (e instanceof GatewayError && e.status !== 400 && e.status !== 429 && e.status < 500) return null;
    }
  }
  return null;
}

export type Turn = { role: "user" | "assistant"; content: string };

/** Plain chat with any registry model. null = no provider configured; undefined = the call failed. */
export async function chat(system: string, history: Turn[], model = DEFAULT_MODEL): Promise<{ text: string; usage: Usage } | null | undefined> {
  if (!llmEnabled) return null;
  try {
    const r = await generate({ model, system, messages: history, effort: "low" });
    return { text: r.text, usage: r.usage };
  } catch (e) {
    console.error("llm chat error", e instanceof Error ? e.message : e);
    return undefined;
  }
}
