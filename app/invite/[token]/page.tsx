import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/actions/team";
import { Logo } from "@/components/logo";

export const metadata = { title: "Join project — Architect" };

export default async function Invite({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const r = await acceptInvite(token); // proxy sends signed-out visitors to /login?next=/invite/…
  if ("projectId" in r) redirect(`/p/${r.projectId}`);
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm space-y-4"><Logo className="justify-center" /><p className="font-medium">{r.error}</p>
        <p className="text-sm text-muted-foreground">Ask the project owner for a new link.</p><Link href="/home" className="text-sm underline underline-offset-2">Go to your home</Link></div>
    </div>
  );
}
