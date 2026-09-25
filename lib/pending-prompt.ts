// Prompt typed before sign-in survives the auth round-trip.
const KEY = "architect:pending-prompt";
export const savePendingPrompt = (p: string) => { try { localStorage.setItem(KEY, p); } catch {} };
export const takePendingPrompt = () => {
  try { const p = localStorage.getItem(KEY); localStorage.removeItem(KEY); return p ?? ""; } catch { return ""; }
};
