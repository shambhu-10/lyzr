"use client";
import { useEffect, useState } from "react";

/** Placeholder that types out example ideas, then erases them — only while `active` (box empty and unfocused). */
export function useTypedPlaceholder(examples: readonly string[], active: boolean, fallback: string) {
  const [text, setText] = useState(fallback);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0, n = 0, deleting = false, t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = examples[i];
      n += deleting ? -1 : 1;
      setText(full.slice(0, n) + (n < full.length || deleting ? "|" : ""));
      let wait = deleting ? 18 : 38 + Math.random() * 40; // human-ish typing rhythm
      if (!deleting && n >= full.length) { deleting = true; wait = 1800; }
      else if (deleting && n <= 0) { deleting = false; i = (i + 1) % examples.length; wait = 350; }
      t = setTimeout(tick, wait);
    };
    t = setTimeout(tick, 600);
    return () => { clearTimeout(t); setText(fallback); };
  }, [active, examples, fallback]);
  return text;
}
