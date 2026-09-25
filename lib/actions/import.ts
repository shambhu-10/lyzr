"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { estimate } from "@/lib/ai/estimate";
import type { Plan } from "@/lib/types";

export type Repo = { full_name: string; name: string; description: string | null; language: string | null; updated_at: string; private: boolean; stargazers_count: number };

/** Real GitHub repo list via the OAuth token captured at sign-in. */
export async function listRepos(): Promise<Repo[] | null> {
  await requireUser();
  const token = (await cookies()).get("gh_token")?.value;
  if (!token) return null;
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Repo[];
}

export async function importRepo(repo: { full_name: string; name: string; language: string | null; description: string | null }, framework: string) {
  const { supabase } = await requireUser();
  const pretty = repo.name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const base: Omit<Plan, "estimate"> = {
    name: pretty,
    tagline: repo.description ?? `Imported from ${repo.full_name}`,
    summary: `Imported from GitHub (${repo.full_name}). Architect kept your code and structure as-is, detected the stack and agents, and listed what it needs to run here.`,
    scope: [
      { item: "Run the existing app unchanged", status: "in", reason: "" },
      { item: "Agent traces and evals", status: "in", reason: "" },
      { item: "Refactors suggested by Architect", status: "later", reason: "Only when you ask — your code, your call." },
    ],
    screens: [{ name: "Home", purpose: "Your existing entry page" }, { name: "App", purpose: "Your existing main flow" }],
    agents: [{ name: `${pretty} Agent`, role: "Detected agent entry point", tools: [] }],
    data: [],
    connections: [{ id: "OPENAI_API_KEY", name: "OPENAI_API_KEY", why: "found in your code's environment variables", kind: "apikey" }],
  };
  const plan: Plan = { ...base, estimate: estimate(base) };
  const slug = `${repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}-${crypto.randomUUID().slice(0, 4)}`;
  const { data, error } = await supabase.from("projects").insert({
    name: pretty, slug, kind: "import", stage: "connect", plan, prompt: `Import ${repo.full_name}`,
    source: { repo: repo.full_name, stack: repo.language ?? "Unknown", framework },
  }).select("id").single();
  if (error) throw error;
  await supabase.from("messages").insert([
    { project_id: data.id, role: "user", content: `Import ${repo.full_name}` },
    { project_id: data.id, role: "assistant", kind: "text", content: `I imported **${repo.full_name}** without changing your code. It needs one secret to run here — add it below, then I'll build and test it.` },
  ]);
  redirect(`/p/${data.id}`);
}
