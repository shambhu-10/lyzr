import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Onboarding } from "./onboarding";

export default async function OnboardingPage() {
  const { user, profile } = await requireUser();
  if (profile?.onboarded) redirect("/home");
  const name = profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
  return <Onboarding defaultName={name} />;
}
