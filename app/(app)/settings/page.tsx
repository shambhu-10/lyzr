import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/actions/profile";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandKit } from "@/components/settings/brand-kit";
import { GithubConnect } from "@/components/settings/github-connect";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team & roles" },
  { id: "brand", label: "Brand kit" },
  { id: "github", label: "GitHub" },
  { id: "api", label: "API & CLI" },
  { id: "billing", label: "Plan & referrals" },
] as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const s = typeof sp.s === "string" ? sp.s : "profile";
  const { user, profile } = await requireUser();
  const gh = user.identities?.find((i) => i.provider === "github");
  const hasToken = !!(await cookies()).get("gh_token");

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-8 px-6 py-6 md:grid-cols-[200px_1fr] md:px-10">
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <Link key={x.id} href={`/settings?s=${x.id}`} className={cn("rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted", s === x.id && "bg-muted font-medium text-foreground")}>{x.label}</Link>
          ))}
        </nav>
        <div className="max-w-2xl">
          {s === "profile" && (
            <form action={updateProfile} className="space-y-5">
              <Field label="Name"><Input name="full_name" defaultValue={profile?.full_name ?? ""} /></Field>
              <Field label="Email"><Input value={user.email ?? ""} disabled /></Field>
              <Field label="Workspace name"><Input name="org_name" defaultValue={profile?.org_name ?? ""} /></Field>
              <Field label="Role">
                <select name="role" defaultValue={profile?.role ?? "product"} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Default view for new projects">
                <select name="default_mode" defaultValue={profile?.default_mode ?? "builder"} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
                  <option value="builder">Builder — plain language, no code</option>
                  <option value="developer">Developer — code, diffs, terminal</option>
                </select>
              </Field>
              <Button type="submit">Save changes</Button>
            </form>
          )}
          {s === "team" && (
            <div className="space-y-4">
              <div className="flex gap-2"><Input placeholder="teammate@company.com" /><select className="h-9 rounded-lg border bg-background px-2 text-sm"><option>Builder</option><option>Developer</option><option>Viewer</option><option>Admin</option></select><Button>Invite</Button></div>
              <div className="divide-y rounded-xl border bg-card">
                <div className="flex items-center justify-between p-3 text-sm"><span>{profile?.full_name || user.email} <span className="text-muted-foreground">(you)</span></span><span className="text-muted-foreground">Owner</span></div>
              </div>
              <p className="text-xs text-muted-foreground">Roles: Admins manage billing & members · Developers can edit code and ship to production · Builders build and ship previews · Viewers comment on previews.</p>
            </div>
          )}
          {s === "brand" && <BrandKit />}
          {s === "github" && <GithubConnect connected={!!gh || hasToken} login={gh?.identity_data?.user_name as string | undefined} />}
          {s === "api" && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">Work on Architect projects from your terminal, Cursor or Claude Code.</p>
              <pre className="overflow-x-auto rounded-xl bg-[oklch(0.18_0.01_260)] p-4 font-mono text-xs leading-6 text-[oklch(0.9_0_0)]">{`npm i -g @architect/cli
architect login
architect pull briefly      # clone project + agents locally
architect dev               # run with your vault secrets
architect push              # sync back (opens a PR if on a branch)`}</pre>
              <p className="text-muted-foreground">Or add Architect as an MCP server so any coding agent can read plans, run builds and deploy.</p>
              <Button variant="outline">Generate access token</Button>
            </div>
          )}
          {s === "billing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border bg-card p-4"><div><div className="font-medium">Free plan</div><div className="text-sm text-muted-foreground">$20 in credits on sign-up</div></div><Button>Upgrade</Button></div>
              <div className="rounded-xl border bg-card p-4"><div className="font-medium">Give $10, get $10</div><div className="mt-1 text-sm text-muted-foreground">Share your link — you both get credits when they ship their first app.</div><Input className="mt-3 font-mono text-xs" readOnly value={`https://architect.new/r/${user.id.slice(0, 8)}`} /></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
