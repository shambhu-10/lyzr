"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 90;

/** Tap to talk, tap to stop. Records in the browser, transcribes with Groq Whisper, hands back editable text. */
export function VoiceButton({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stopAll = useRef<() => void>(() => {});

  useEffect(() => () => stopAll.current(), []);

  const start = async () => {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast.error("Microphone access was blocked. Allow it in your browser's site settings."); return; }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream);
    rec.current = mr;
    // Live level meter so people can see it's hearing them.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => { analyser.getByteTimeDomainData(buf); setLevel(Math.min(1, Math.max(...buf.map((v) => Math.abs(v - 128))) / 64)); raf = requestAnimationFrame(tick); };
    tick();
    const started = Date.now();
    const timer = setInterval(() => { const s = Math.round((Date.now() - started) / 1000); setSecs(s); if (s >= MAX_SECONDS) mr.stop(); }, 250);
    stopAll.current = () => { clearInterval(timer); cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };

    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stopAll.current();
      setState("working"); setLevel(0);
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      const fd = new FormData();
      fd.append("audio", new File([blob], `voice.${(mr.mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm"}`, { type: blob.type }));
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const j = (await res.json()) as { text?: string; error?: string };
        if (j.text) onText(j.text); else toast.error(j.error ?? "Couldn't transcribe that");
      } catch { toast.error("Couldn't reach the transcription service"); }
      setState("idle"); setSecs(0);
    };
    mr.start();
    setState("recording");
  };

  return (
    <button type="button" onClick={() => (state === "recording" ? rec.current?.stop() : state === "idle" && start())} disabled={state === "working"}
      aria-label={state === "recording" ? "Stop recording" : "Speak instead of typing"} title={state === "recording" ? "Tap to stop" : "Speak instead of typing"}
      className={cn("relative flex h-7 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground", state === "recording" && "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive", className)}>
      {state === "working" ? <Loader2 className="size-3.5 animate-spin" /> : state === "recording" ? <Square className="size-3 fill-current" /> : <Mic className="size-3.5" />}
      {state === "recording" && (
        <>
          <span className="flex h-3 items-end gap-px" aria-hidden>{[0.5, 1, 0.7, 0.9, 0.6].map((m, i) => <span key={i} className="w-0.5 rounded bg-current transition-all" style={{ height: `${Math.max(15, level * m * 100)}%` }} />)}</span>
          <span className="font-mono text-[10px] tabular-nums">0:{String(secs).padStart(2, "0")}</span>
        </>
      )}
      {state === "working" && <span className="text-[10px]">Transcribing…</span>}
    </button>
  );
}
