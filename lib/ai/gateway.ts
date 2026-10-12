import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, MODEL_REGISTRY, costOf, modelInfo, type ModelInfo, type Provider, type Tier } from "./models";

/**
 * Model gateway: every AI call in Architect goes through generate().
 * One request shape for all providers; adapters translate it (OpenAI-compatible for Groq / OpenAI / Gemini,
 * the native SDK for Claude). Adds what callers shouldn't think about: usage + cost, rate-limit waits,
 * and falling back to another enabled model in the same tier.
 */

export type ToolCall = { id: string; name: string; args: string };
export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[]; raw?: unknown } // raw = provider-native content, replayed unchanged
  | { role: "tool"; toolCallId: string; content: string };
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type GenerateRequest = {
  model?: string; // a registry id; unknown or not-enabled → best enabled model in the tier
  tier?: Tier;
  system?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  json?: { name: string; schema: Record<string, unknown> }; // structured output
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};
export type Usage = { model: string; input_tokens: number; output_tokens: number; ms: number; cost_usd: number | null };
export type GenerateResult = { text: string; toolCalls: ToolCall[]; raw?: unknown; usage: Usage };

export class GatewayError extends Error {
  constructor(message: string, public status: number, public retryAfterMs = 0, public partial?: string) { super(message); }
}

const KEYS: Record<Provider, string | undefined> = {
  groq: process.env.GROQ_API_KEY, openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, google: process.env.GEMINI_API_KEY,
};
const BASE: Record<Exclude<Provider, "anthropic">, string> = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai", // Google's official OpenAI-compatible endpoint
};

export const enabledProviders = () => (Object.keys(KEYS) as Provider[]).filter((p) => !!KEYS[p]);
export const llmEnabled = enabledProviders().length > 0;
const isEnabled = (m?: ModelInfo): m is ModelInfo => !!m && !!KEYS[m.provider];

/** Requested model first (if its provider has a key), then other enabled models in the same tier, in registry order. */
function candidates(id: string | undefined, tier: Tier, needsTools: boolean) {
  const want = modelInfo(id) ?? (tier === "strong" ? modelInfo(DEFAULT_MODEL) : undefined);
  const t = want?.tier ?? tier;
  const rest = MODEL_REGISTRY.filter((m) => m.tier === t && m.id !== want?.id && isEnabled(m) && (!needsTools || m.tools));
  return [...(isEnabled(want) ? [want] : []), ...rest];
}

export const usageOf = (model: string, input_tokens: number, output_tokens: number, t0: number): Usage =>
  ({ model, input_tokens, output_tokens, ms: Date.now() - t0, cost_usd: costOf(model, input_tokens, output_tokens) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generate(req: GenerateRequest): Promise<GenerateResult> {
  const chain = candidates(req.model, req.tier ?? "strong", !!req.tools?.length);
  if (!chain.length) throw new GatewayError("No AI provider is configured", 503);
  let last: GatewayError | undefined;
  for (const m of chain.slice(0, 2)) { // the chosen model + one same-tier fallback
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return m.provider === "anthropic" ? await claude(m, req) : await openaiCompatible(m, req);
      } catch (e) {
        if (!(e instanceof GatewayError)) throw e;
        last = e;
        // Short rate-limit waits are cheaper than switching models; long ones move to the fallback.
        if (e.status === 429 && attempt === 0 && e.retryAfterMs <= 20_000) { await sleep(Math.max(e.retryAfterMs, 1000)); continue; }
        if (e.status === 429 || e.status === 0 || e.status >= 500) break;
        throw e; // 4xx: the request itself is wrong; another model won't fix it
      }
    }
  }
  throw last!;
}

/* ---------- OpenAI-compatible adapter (Groq, OpenAI, Gemini) ---------- */

const REASONING = /^(openai\/gpt-oss|gpt-5|gemini-2\.5)/; // models that accept reasoning_effort

function retryAfter(res: Response) {
  const s = Number(res.headers.get("retry-after"));
  return Number.isFinite(s) && s > 0 ? s * 1000 : 0;
}

async function openaiCompatible(m: ModelInfo, req: GenerateRequest): Promise<GenerateResult> {
  const t0 = Date.now();
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    ...req.messages.map((x) =>
      x.role === "tool" ? { role: "tool", tool_call_id: x.toolCallId, content: x.content }
      : x.role === "assistant" ? { role: "assistant", content: x.content || null, ...(x.toolCalls?.length ? { tool_calls: x.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })) } : {}) }
      : x),
  ];
  const body = {
    model: m.id,
    messages,
    ...(req.maxTokens ? { max_completion_tokens: req.maxTokens } : {}),
    ...(req.effort && REASONING.test(m.id) ? { reasoning_effort: req.effort } : {}),
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: "function", function: t })) } : {}),
    ...(req.json ? { response_format: { type: "json_schema", json_schema: { name: req.json.name, strict: true, schema: req.json.schema } } } : {}),
  };
  const res = await fetch(`${BASE[m.provider as keyof typeof BASE]}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEYS[m.provider]}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new GatewayError(`${m.provider}: network error`, 0);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Groq returns output that broke the schema as failed_generation; structured() may still salvage it.
    throw new GatewayError(`${m.provider} ${res.status}: ${String(data?.error?.message ?? res.statusText).slice(0, 300)}`, res.status, retryAfter(res), data?.error?.failed_generation);
  }
  const msg = data.choices?.[0]?.message ?? {};
  const calls = (msg.tool_calls ?? []) as { id: string; function: { name: string; arguments?: string } }[];
  return {
    text: msg.content ?? "",
    toolCalls: calls.map((c) => ({ id: c.id, name: c.function.name, args: c.function.arguments || "{}" })),
    usage: usageOf(m.id, data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0, t0),
  };
}

/* ---------- Claude adapter (official SDK) ---------- */

const anthropic = KEYS.anthropic ? new Anthropic() : null;
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]); // server-side refusal fallback ("default" routing)

const parseArgs = (s: string) => { try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; } };

async function claude(m: ModelInfo, req: GenerateRequest): Promise<GenerateResult> {
  if (!anthropic) throw new GatewayError("anthropic: no key", 503);
  const t0 = Date.now();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const x of req.messages) {
    if (x.role === "tool") {
      const block: Anthropic.Beta.BetaToolResultBlockParam = { type: "tool_result", tool_use_id: x.toolCallId, content: x.content };
      const prev = messages.at(-1);
      // every result for one assistant turn goes back in a single user message
      if (prev?.role === "user" && Array.isArray(prev.content) && prev.content.every((b) => b.type === "tool_result")) prev.content.push(block);
      else messages.push({ role: "user", content: [block] });
    } else if (x.role === "assistant") {
      // replay Claude's own blocks unchanged (thinking blocks must not be edited); otherwise rebuild from the shared shape
      const content = (x.raw as Anthropic.Beta.BetaContentBlockParam[] | undefined) ?? [
        ...(x.content ? [{ type: "text" as const, text: x.content }] : []),
        ...(x.toolCalls ?? []).map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: parseArgs(c.args) })),
      ];
      messages.push({ role: "assistant", content });
    } else messages.push({ role: "user", content: x.content });
  }
  try {
    const res = await anthropic.beta.messages.create({
      model: m.id,
      max_tokens: req.maxTokens ?? 16000,
      ...(req.system ? { system: req.system } : {}),
      messages,
      ...(req.tools?.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema })) } : {}),
      ...(req.effort || req.json ? { output_config: { ...(req.effort ? { effort: req.effort } : {}), ...(req.json ? { format: { type: "json_schema" as const, schema: req.json.schema } } : {}) } } : {}),
      ...(FALLBACK_MODELS.has(m.id) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (res.stop_reason === "refusal") throw new GatewayError(`${m.label} declined this request`, 422);
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const toolCalls = res.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, args: JSON.stringify(b.input) }] : []));
    return { text, toolCalls, raw: res.content, usage: usageOf(m.id, res.usage.input_tokens, res.usage.output_tokens, t0) };
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    if (e instanceof Anthropic.APIError) throw new GatewayError(`anthropic ${e.status}: ${e.message.slice(0, 300)}`, e.status ?? 0, Number(e.headers?.get?.("retry-after")) * 1000 || 0);
    throw e;
  }
}
