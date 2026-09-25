"use client";
import { useEffect, useRef } from "react";

/**
 * Leonardo da Vinci's ornithopter (public domain, traced: /public/davinci/ornithopter.svg), black and white.
 * The trace is one drawing, so the wings are "cut out" with clip-paths (classic cutout animation): the same drawing is
 * shown three times — far wing, body, near wing — and each wing copy rotates around its shoulder.
 * Paths are tone-tagged (--k outline, --m mid, --l membrane), so it follows the theme: ink on paper in light, chalk in dark.
 */
const SRC = "/davinci/ornithopter.svg";
const WING_FAR = "0,0 960,0 960,540 860,590 700,640 0,640";
const WING_NEAR = "1000,560 1536,560 1536,780 1100,780 1040,700 1000,660";
const BODY = "0,640 700,640 860,590 960,540 960,0 1536,0 1536,560 1000,560 1000,660 1040,700 1100,780 1536,780 1536,1024 0,1024";
/** Resting point (bottom of the frame) as a fraction of the drawing's box — used to perch it on the A. */
export const ANCHOR = { x: 0.59, y: 0.91 };
export const ASPECT = 900 / 1490;

let drawing: Promise<string> | null = null; // one fetch per page
const load = () => (drawing ??= fetch(SRC).then((r) => r.text()).then((t) => t.slice(t.indexOf('<g id="dv">') + 11, t.lastIndexOf("</g>"))));

export function Ornithopter({ onReady, className }: { onReady?: () => void; className?: string }) {
  const master = useRef<SVGGElement>(null);
  useEffect(() => {
    let live = true;
    load().then((inner) => { if (live && master.current) { master.current.innerHTML = inner; onReady?.(); } }).catch(() => {});
    return () => { live = false; };
  }, [onReady]);
  return (
    <svg viewBox="20 40 1490 900" aria-hidden className={`overflow-visible ${className ?? ""}`}
      style={{ "--k": "currentColor", "--m": "color-mix(in oklab, currentColor 55%, transparent)", "--l": "color-mix(in oklab, currentColor 7%, var(--background))" } as React.CSSProperties}>
      <defs>
        <g id="ph-dv" ref={master} />
        <clipPath id="ph-clip-far"><polygon points={WING_FAR} /></clipPath>
        <clipPath id="ph-clip-near"><polygon points={WING_NEAR} /></clipPath>
        <clipPath id="ph-clip-body"><polygon points={BODY} /></clipPath>
      </defs>
      <g className="ph-wing-far"><use href="#ph-dv" clipPath="url(#ph-clip-far)" /></g>
      <use href="#ph-dv" clipPath="url(#ph-clip-body)" />
      <g className="ph-wing-near"><use href="#ph-dv" clipPath="url(#ph-clip-near)" /></g>
    </svg>
  );
}
