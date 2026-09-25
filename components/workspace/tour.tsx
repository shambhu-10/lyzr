"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { sel: '[aria-label="Project stages"]', title: "Five clear steps", body: "Plan → Connect → Build → Test → Ship. You always know where you are — click a finished step to look back." },
  { sel: '[aria-label="Developer view"]', title: "Builder or Developer — your choice", body: "Flip this anytime. Builder hides the technical parts; Developer opens code, diffs, terminal, logs and environments. Same project either way." },
  { sel: '[aria-label="Chat with Architect"]', title: "Talk to Architect", body: "Answer questions, ask for changes in plain words, and follow the build here. Nothing is built until you approve the plan." },
  { sel: '[aria-label="Your app"]', title: "Your app, live", body: "Plan, preview, agents and versions live on this side. In Preview, turn on Comment to leave feedback right on the app." },
];
const KEY = "architect:tour-done";

/** First-run tour: 4 short cards pointing at the parts of the workspace people need first. */
export function Tour() {
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    let done = true;
    try { done = localStorage.getItem(KEY) === "1"; } catch {}
    if (done) return;
    const t = setTimeout(() => setI(0), 800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (i < 0) return;
    const measure = () => setBox(document.querySelector(STEPS[i].sel)?.getBoundingClientRect() ?? null);
    const t = setTimeout(measure, 0);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [i]);
  if (i < 0) return null;
  const end = () => { try { localStorage.setItem(KEY, "1"); } catch {} setI(-1); };
  const step = STEPS[i];
  const top = box ? Math.min(window.innerHeight - 190, box.bottom + 10) : window.innerHeight / 2 - 80;
  const left = box ? Math.min(Math.max(12, box.left), window.innerWidth - 332) : window.innerWidth / 2 - 160;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Workspace tour">
      <div className="absolute inset-0 bg-black/30" onClick={end} />
      {box && <div className="pointer-events-none absolute rounded-xl ring-4 ring-brand/70 transition-all" style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }} />}
      <div className="rise absolute w-80 rounded-xl border bg-popover p-4 shadow-xl" style={{ top, left }}>
        <div className="text-xs text-muted-foreground">{i + 1} of {STEPS.length}</div>
        <div className="mt-1 font-semibold">{step.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex justify-between">
          <Button size="sm" variant="ghost" onClick={end}>Skip</Button>
          <Button size="sm" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : end())}>{i + 1 < STEPS.length ? "Next" : "Got it"}</Button>
        </div>
      </div>
    </div>
  );
}
