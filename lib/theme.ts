import type { CSSProperties } from "react";

/** The look of a generated app. Enums only, so any theme the AI proposes renders predictably. */
export const ACCENTS = {
  teal: ["#139C8E", "#0E7C71"],
  indigo: ["#4F5BD5", "#3A44A8"],
  coral: ["#E0654A", "#B84A33"],
  amber: ["#C98410", "#8F5E08"],
  emerald: ["#1E9E5A", "#157544"],
  rose: ["#D1467A", "#A5325D"],
  violet: ["#7C4DDB", "#5E35B1"],
  slate: ["#475569", "#1E293B"],
} as const;
export const RADII = { sharp: "0.3rem", soft: "0.625rem", round: "1.1rem" } as const;
export const FONTS = { sans: "var(--font-sans)", serif: "var(--font-display)", mono: "var(--font-mono)" } as const;
export const SIDEBARS = ["light", "tint", "dark"] as const;

export type AppTheme = {
  name: string;
  why: string;
  accent: keyof typeof ACCENTS;
  radius: keyof typeof RADII;
  font: keyof typeof FONTS;
  sidebar: (typeof SIDEBARS)[number];
};

export const DEFAULT_THEME: AppTheme = { name: "Calm", why: "", accent: "teal", radius: "soft", font: "serif", sidebar: "light" };

/** CSS variables for the AppPreview root. `--radius` cascades through the @theme inline radius utilities; `--app-font` styles headings. */
export function themeStyle(t: AppTheme = DEFAULT_THEME): CSSProperties {
  const [a, ink] = ACCENTS[t.accent] ?? ACCENTS.teal;
  const side = t.sidebar === "dark" ? ["#171A21", "#FFFFFF"] : t.sidebar === "tint" ? [`color-mix(in oklab, ${a} 9%, white)`, "#1F2430"] : ["#FFFFFF", "#1F2430"];
  return {
    "--a": a, "--a-ink": ink, "--side-active": t.sidebar === "dark" ? "#FFFFFF" : ink,
    "--app-side": side[0], "--app-side-fg": side[1],
    "--radius": RADII[t.radius] ?? RADII.soft,
    "--app-font": FONTS[t.font] ?? FONTS.serif,
  } as CSSProperties;
}
