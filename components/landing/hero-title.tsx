"use client";
import { useCallback, useEffect, useState } from "react";
import { ANCHOR, ASPECT, Ornithopter } from "./ornithopter";

const KEY = "architect:intro";
const W = 1.9; // machine width in em of the title — about as big as on architect.new

/**
 * "Architect" with Leonardo's flying machine resting on the A (as on architect.new). On the first visit of a session it
 * beats its wings and "2.0" emerges; afterwards everything is simply there. Hover the machine to see it flap again.
 */
export function HeroTitle() {
  const [ready, setReady] = useState(false);
  const [two, setTwo] = useState(false);
  const [flap, setFlap] = useState(0); // bump to replay a wing-beat burst
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); } catch {}
    const still = seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => { setTwo(true); if (!still) setFlap(1); }, still ? 0 : 700);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <h1 className="relative mx-auto text-[2.6rem] leading-none font-semibold tracking-[-0.04em] sm:text-[3.2rem] md:text-[3.8rem]">
      <span className="relative inline-block">
        A
        {/* decorative: kept out of the heading's accessible name; hovering it makes it beat its wings */}
        <span aria-hidden onMouseEnter={() => setFlap((n) => n + 1)} data-ready={ready} data-flap={flap ? (flap % 2 ? "a" : "b") : undefined}
          style={{ width: `${W}em`, left: `calc(50% - ${W * ANCHOR.x}em)`, top: `${0.34 - W * ASPECT * ANCHOR.y}em` /* frame sits into the top of the A, as on architect.new */, transform: "rotate(5deg)", transformOrigin: `${ANCHOR.x * 100}% ${ANCHOR.y * 100}%` }}
          className="ph-machine absolute block text-foreground">
          <Ornithopter onReady={onReady} className="block w-full" />
        </span>
      </span>
      rchitect <span className="ph-two font-display font-normal tracking-normal text-brand italic" data-on={two}>2.0</span>
    </h1>
  );
}
