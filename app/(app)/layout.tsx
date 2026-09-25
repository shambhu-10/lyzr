import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { balance } from "@/lib/usage";
import { CommandPalette } from "@/components/shell/command-palette";
import { SessionKeeper } from "@/components/shell/session-keeper";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, user, profile } = await requireUser();
  if (!profile?.onboarded) redirect("/onboarding");
  const name = profile.full_name ?? "";
  const { data: projects } = await supabase.from("projects").select("stage, plan").eq("owner_id", user.id); // credits: own projects only
  return (
    <div className="flex min-h-screen">
      <Sidebar name={name} email={user.email ?? ""} org={profile.org_name ?? ""} credits={balance(projects ?? [])} />
      <div className="min-w-0 flex-1 pb-16 md:pb-0">
        <MobileNav />
        {children}
      </div>
      <CommandPalette />
      <SessionKeeper />
    </div>
  );
}
