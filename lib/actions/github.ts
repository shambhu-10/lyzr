"use server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/server";

/**
 * Real GitHub push with the user's OAuth token (repo scope, kept in an httpOnly cookie).
 * Each push is one commit made through the Git Data API: tree → commit → move the branch. Never a force-push.
 * ponytail: OAuth token per user; a GitHub App (per-repo install, 1-hour tokens, webhooks for two-way sync) is the production version.
 */
export type GithubLink = { repo: string; url: string; branch: string; commit?: string; pushedAt?: string };

const API = "https://api.github.com";

async function gh(token: string, path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null), scopes: res.headers.get("x-oauth-scopes") ?? "" };
}

const token = async () => (await cookies()).get("gh_token")?.value;
const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function githubStatus(projectId: string) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("projects").select("source").eq("id", projectId).single();
  const link = ((p?.source as { github?: GithubLink } | null)?.github) ?? null;
  const t = await token();
  const me = t ? await gh(t, "/user") : null;
  if (!me?.ok) return { connected: false, canPush: false, login: null, link };
  return { connected: true, canPush: /(^|[ ,])(repo|public_repo)(,|$)/.test(me.scopes), login: me.data.login as string, link };
}

export async function pushToGitHub(projectId: string, opts: { name?: string; branch?: string }) {
  const { supabase } = await requireUser();
  const t = await token();
  if (!t) return { error: "Connect GitHub first." };
  const { data: project } = await supabase.from("projects").select("id, slug, name, plan, source").eq("id", projectId).single();
  if (!project) return { error: "Project not found" };
  const { data: files } = await supabase.from("files").select("path, content").eq("project_id", projectId);
  if (!files?.length) return { error: "Build the app first — there's no code to push yet." };

  // First push: create a private repo (auto_init gives it a first commit to build on).
  let link = (project.source as { github?: GithubLink } | null)?.github;
  if (!link) {
    const name = clean(opts.name || project.slug).replace(/\//g, "-") || "architect-app";
    const r = await gh(t, "/user/repos", { method: "POST", body: { name, private: true, auto_init: true, description: project.plan?.tagline ?? `Built with Architect` } });
    if (r.status === 422) return { error: `You already have a repo called “${name}”. Pick another name.` };
    if (!r.ok) return { error: r.status === 403 || r.status === 404 ? "GitHub didn't allow creating a repo — reconnect and grant repo access." : `GitHub error ${r.status}` };
    link = { repo: r.data.full_name, url: r.data.html_url, branch: r.data.default_branch ?? "main" };
  }

  const base = link.branch;
  const branch = clean(opts.branch ?? "") || base;
  const tip = await gh(t, `/repos/${link.repo}/git/ref/heads/${branch}`);
  const newBranch = !tip.ok;
  const from = newBranch ? await gh(t, `/repos/${link.repo}/git/ref/heads/${base}`) : tip;
  if (!from.ok) return { error: `Couldn't read ${link.repo}@${base} (GitHub ${from.status}).` };
  const parent = from.data.object.sha as string;
  const parentCommit = await gh(t, `/repos/${link.repo}/git/commits/${parent}`);

  // Our files on top of what's there; files we don't generate (a README, the user's own edits elsewhere) stay.
  const tree = await gh(t, `/repos/${link.repo}/git/trees`, { method: "POST", body: { base_tree: parentCommit.data?.tree?.sha, tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) } });
  if (!tree.ok) return { error: `GitHub rejected the files (${tree.status}).` };
  const commit = await gh(t, `/repos/${link.repo}/git/commits`, { method: "POST", body: { message: `Architect: ${project.name} (${files.length} files)`, tree: tree.data.sha, parents: [parent] } });
  if (!commit.ok) return { error: `Couldn't create the commit (${commit.status}).` };
  const sha = commit.data.sha as string;
  const moved = newBranch
    ? await gh(t, `/repos/${link.repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha } })
    : await gh(t, `/repos/${link.repo}/git/refs/heads/${branch}`, { method: "PATCH", body: { sha, force: false } });
  if (!moved.ok) return { error: moved.status === 422 ? "Someone pushed to that branch meanwhile — push again to build on top." : `Couldn't update ${branch} (${moved.status}).` };

  // A branch other than the default gets a pull request (reused if one is already open).
  let pr: string | null = null;
  if (branch !== base) {
    const open = await gh(t, `/repos/${link.repo}/pulls`, { method: "POST", body: { title: `Architect: ${project.name}`, head: branch, base, body: "Changes generated with Architect. Review and merge when ready." } });
    if (open.ok) pr = open.data.html_url;
    else {
      const existing = await gh(t, `/repos/${link.repo}/pulls?head=${link.repo.split("/")[0]}:${branch}&state=open`);
      pr = existing.data?.[0]?.html_url ?? null;
    }
  }

  const saved: GithubLink = { ...link, commit: sha, pushedAt: new Date().toISOString() };
  await supabase.from("projects").update({ source: { ...(project.source ?? {}), github: saved } }).eq("id", projectId);
  return { link: saved, commitUrl: `${link.url}/commit/${sha}`, pr, files: files.length, branch };
}
