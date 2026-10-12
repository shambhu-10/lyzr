import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 8 * 1024 * 1024; // ~8 MB ≈ several minutes of opus audio
const MODEL = "whisper-large-v3-turbo";

/** Voice input: signed-in users send a short recording, Groq Whisper returns the text. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });
  if (!process.env.GROQ_API_KEY) return Response.json({ error: "Voice input needs a Groq API key" }, { status: 503 });

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "Recording is too long" }, { status: 413 });

  const t0 = Date.now();
  const body = new FormData();
  body.set("file", audio);
  body.set("model", MODEL);
  body.set("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok || typeof data?.text !== "string") {
    console.error("transcribe error", res?.status, data?.error?.message);
    return Response.json({ error: "Couldn't transcribe that — please try again" }, { status: 502 });
  }
  await supabase.from("usage_events").insert({ kind: "voice", model: MODEL, ms: Date.now() - t0, cost_usd: null });
  return Response.json({ text: data.text.trim() });
}
