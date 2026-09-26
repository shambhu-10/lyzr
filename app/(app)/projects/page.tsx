import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "draft", label: "In progress" },
  { id: "shared", label: "Shared with me" },
] as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const sp = await searchParams;
  const filter = typeof sp.f === "string" ? sp.f : "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const { supabase, user } = await requireUser();
  let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });
  query = filter === "shared" ? query.neq("owner_id", user.id) : query.eq("owner_id", user.id); // shared = invited via a teammate
  if (filter === "live") query = query.eq("stage", "live");
  if (filter === "draft") query = query.neq("stage", "live");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query;
  const projects = (data ?? []) as Project[];

  return (
    <>
      <PageHeader title="Projects" description="Every app and agent you've built, in one place."
        actions={<Button asChild><Link href="/home"><Plus /> New project</Link></Button>} />
      <div className="px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <Link key={f.id} href={`/projects?f=${f.id}${q ? `&q=${q}` : ""}`}
                className={cn("rounded-md px-3 py-1 text-sm text-muted-foreground", filter === f.id && "bg-background font-medium text-foreground shadow-sm")}>{f.label}</Link>
            ))}
          </div>
          <form className="w-full sm:w-64"><input type="hidden" name="f" value={filter} />
            <input name="q" defaultValue={q} placeholder="Search projects…" aria-label="Search projects" className="h-9 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:ring-3 focus:ring-ring/25" />
          </form>
        </div>
        {projects.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{projects.map((p) => <ProjectCard key={p.id} p={p} owned={p.owner_id === user.id} />)}</div>
        ) : (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
            <p className="font-medium">{filter === "shared" ? "Nothing shared with you yet" : q ? `No projects match “${q}”` : filter === "live" ? "Nothing is live yet" : "No projects yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "shared" ? "When a teammate invites you to a project, it appears here." : "Describe an idea on Home, start from a template, or import a repo."}
            </p>
            <div className="mt-5 flex gap-2">
              <Button asChild><Link href="/home">Start a project</Link></Button>
              <Button variant="outline" asChild><Link href="/explore">Browse templates</Link></Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
