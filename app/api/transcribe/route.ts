import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 8 * 1024 * 1024; // ~8 MB ≈ several minutes of opus audio

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

  try {
    const t0 = Date.now();
    const r = await new Groq().audio.transcriptions.create({ file: audio, model: "whisper-large-v3-turbo", response_format: "json" });
    await supabase.from("usage_events").insert({ kind: "voice", model: "whisper-large-v3-turbo", ms: Date.now() - t0, cost_usd: null });
    return Response.json({ text: r.text.trim() });
  } catch (e) {
    console.error("transcribe error", e instanceof Groq.APIError ? `${e.status} ${e.message}` : e);
    return Response.json({ error: "Couldn't transcribe that — please try again" }, { status: 502 });
  }
}
