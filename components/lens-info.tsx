import type { Mode } from "@/lib/types";

/** What each view means — shown on hover wherever you pick Builder or Developer. */
export const LENS_INFO: Record<Mode, { title: string; points: string[] }> = {
  builder: {
    title: "Builder view — no code needed",
    points: ["Plain-language questions and a readable plan", "Watch screens appear; edit text and looks by clicking", "Connect your tools, test and ship in a few clicks"],
  },
  developer: {
    title: "Developer view — full control",
    points: ["Technical questions: data model, auth, APIs", "Tech spec: stack, schema + SQL, files, routes, env", "Code editor with AI, diffs, logs and GitHub"],
  },
};

export function LensTip({ mode }: { mode: Mode }) {
  const i = LENS_INFO[mode];
  return (
    <div className="max-w-60 space-y-1 py-0.5 text-left">
      <div className="font-medium">{i.title}</div>
      <ul className="space-y-0.5 opacity-80">{i.points.map((p) => <li key={p}>• {p}</li>)}</ul>
      <div className="pt-0.5 opacity-60">Same project either way — switch anytime.</div>
    </div>
  );
}
