import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ConnectionsBoard } from "@/components/connect/connections-board";

export default async function ConnectionsPage() {
  const { profile } = await requireUser();
  return (
    <>
      <PageHeader title="Connections" description="Connect your tools once. Every project and agent in this workspace can use them — with the permissions you approve." />
      <div className="px-6 py-6 md:px-10"><ConnectionsBoard connected={profile?.connections ?? {}} /></div>
    </>
  );
}
