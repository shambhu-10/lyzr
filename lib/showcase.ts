import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Plan } from "./types";

export type ShowcaseApp = { slug: string; name: string; tagline: string; plan: Plan; author: string | null; views: number; remixes: number; updated_at: string };

/** Public, opt-in gallery of live apps. Cookie-free client so the landing page can stay static (ISR). */
export async function getShowcase(limit = 12): Promise<ShowcaseApp[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("showcase_projects", { p_limit: limit });
  if (error) { console.error("showcase:", error.message); return []; } // e.g. migration 0004 not applied yet
  return (data ?? []) as ShowcaseApp[];
}
