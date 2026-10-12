/**
 * Model registry: the one place that knows which models exist, what they can do and what they cost.
 * Client-safe (no keys here) — the gateway (lib/ai/gateway.ts) decides which providers are enabled.
 */
export type Provider = "groq" | "openai" | "anthropic" | "google";
export type Tier = "strong" | "fast"; // fallbacks only ever move within a tier

export type ModelInfo = {
  id: string;
  label: string;
  provider: Provider;
  tier: Tier;
  tools: boolean; // reliable tool calling (needed by the build agent)
  price: { in: number; out: number } | null; // USD per 1M tokens; null = not published
};

export const PROVIDER_LABEL: Record<Provider, string> = { groq: "Groq", openai: "OpenAI", anthropic: "Anthropic", google: "Google" };

// List prices per 1M tokens (Oct 2026). Groq ids verified against our key's /models list; check the others' pricing pages before billing on them.
export const MODEL_REGISTRY: ModelInfo[] = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq", tier: "strong", tools: true, price: { in: 0.15, out: 0.6 } },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", provider: "groq", tier: "strong", tools: true, price: null },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq", tier: "fast", tools: true, price: { in: 0.075, out: 0.3 } },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", tier: "strong", tools: true, price: { in: 4, out: 20 } },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", tier: "strong", tools: true, price: { in: 2, out: 10 } },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", provider: "anthropic", tier: "fast", tools: true, price: { in: 0.1, out: 0.5 } },
  { id: "gpt-5.4", label: "GPT-5.4", provider: "openai", tier: "strong", tools: true, price: { in: 2.5, out: 15 } },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", provider: "openai", tier: "fast", tools: true, price: { in: 0.75, out: 4.5 } },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", tier: "strong", tools: true, price: { in: 1.25, out: 10 } },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", tier: "fast", tools: true, price: { in: 0.3, out: 2.5 } },
];

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const modelInfo = (id?: string) => MODEL_REGISTRY.find((m) => m.id === id);
export const modelLabel = (id?: string) => { const m = modelInfo(id); return m ? `${m.label} · ${PROVIDER_LABEL[m.provider]}` : (id ?? ""); };

/** Real cost of one call from the registry's list price (null when the price isn't published). */
export const costOf = (id: string, inputTokens: number, outputTokens: number) => {
  const p = modelInfo(id)?.price;
  return p ? (inputTokens * p.in + outputTokens * p.out) / 1e6 : null;
};
