"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Headphones, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "architect:focus-music";

/**
 * Generative ambient music with the Web Audio API — no audio files, no licensing.
 * Slow pad chords (Cmaj7 → Am9 → Fmaj7 → G6) through a low-pass filter and a soft echo, plus sparse high notes.
 */
class Ambient {
  ctx = new AudioContext();
  master = this.ctx.createGain();
  timers: ReturnType<typeof setInterval>[] = [];
  constructor(volume: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1400;
    const delay = this.ctx.createDelay(); delay.delayTime.value = 0.45;
    const fb = this.ctx.createGain(); fb.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    this.master.gain.value = 0;
    this.master.connect(lp); lp.connect(this.ctx.destination); lp.connect(delay); delay.connect(this.ctx.destination);
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2);
  }
  note(freq: number, start: number, length: number, peak: number, type: OscillatorType = "triangle") {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + Math.min(2, length / 3));
    g.gain.linearRampToValueAtTime(0, start + length);
    o.connect(g).connect(this.master); o.start(start); o.stop(start + length + 0.1);
  }
  start() {
    const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);
    const chords = [[48, 52, 55, 59], [45, 52, 55, 59, 62], [41, 48, 52, 57], [43, 50, 52, 55]];
    const penta = [72, 74, 76, 79, 81, 84];
    let i = 0;
    const playChord = () => { const t = this.ctx.currentTime; chords[i++ % chords.length].forEach((n, k) => this.note(hz(n), t + k * 0.08, 7.5, 0.05)); };
    playChord();
    this.timers.push(setInterval(playChord, 7000));
    this.timers.push(setInterval(() => { if (Math.random() < 0.55) this.note(hz(penta[Math.floor(Math.random() * penta.length)]), this.ctx.currentTime, 2.4, 0.025, "sine"); }, 1700));
  }
  setVolume(v: number) { this.master.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.3); }
  chime() { const t = this.ctx.currentTime; this.note(880, t, 1.4, 0.08, "sine"); this.note(1318.5, t + 0.18, 1.8, 0.07, "sine"); }
  stop(after = 1.5) {
    this.timers.forEach(clearInterval);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + after);
    setTimeout(() => void this.ctx.close(), (after + 2.5) * 1000);
  }
}

/** Keeps people in flow during a build: optional ambient music, useful things to do, and a chime when it's done. */
export function FocusMode({ done, tips }: { done: boolean; tips: { label: string; onClick: () => void }[] }) {
  const [on, setOn] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const engine = useRef<Ambient | null>(null);

  // Browsers only allow audio after a user gesture, so we never autoplay — we just remember the preference.
  const wanted = useSyncExternalStore(() => () => {}, () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }, () => false);

  const toggle = () => {
    if (engine.current) { engine.current.stop(0.8); engine.current = null; setOn(false); try { localStorage.setItem(KEY, "0"); } catch {} return; }
    engine.current = new Ambient(volume * 0.6); engine.current.start(); setOn(true);
    try { localStorage.setItem(KEY, "1"); } catch {}
  };

  useEffect(() => {
    if (!done || !engine.current) return;
    engine.current.chime(); engine.current.stop(3); engine.current = null;
    const t = setTimeout(() => setOn(false), 0);
    return () => clearTimeout(t);
  }, [done]);
  useEffect(() => () => engine.current?.stop(0.3), []);

  if (done) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed p-2.5">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition", on ? "border-brand bg-brand-soft text-brand" : "hover:bg-muted", !on && wanted && "ring-2 ring-brand/30")}>
          {on ? <Pause className="size-3" /> : <Headphones className="size-3" />} {on ? "Focus music on" : "Play focus music"}
        </button>
        {on && (
          <label className="flex flex-1 items-center gap-1.5 text-muted-foreground"><Volume2 className="size-3.5" />
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); engine.current?.setVolume(v * 0.6); }} aria-label="Music volume" className="h-1 flex-1 accent-[var(--brand)]" />
          </label>
        )}
        {on && <span className="flex h-3 items-end gap-px" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="w-0.5 animate-pulse rounded bg-brand" style={{ height: `${40 + ((i * 23) % 60)}%`, animationDelay: `${i * 0.2}s` }} />)}</span>}
      </div>
      {tips.length > 0 && (
        <div className="text-xs text-muted-foreground">
          While you wait:
          <div className="mt-1.5 flex flex-wrap gap-1.5">{tips.map((t) => <button key={t.label} onClick={t.onClick} className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-muted">{t.label}</button>)}</div>
        </div>
      )}
    </div>
  );
}
