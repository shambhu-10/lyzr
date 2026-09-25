"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export async function completeOnboarding(form: FormData) {
  const { supabase, user } = await requireUser();
  const mode = form.get("mode") === "developer" ? "developer" : "builder";
  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: String(form.get("full_name") ?? "").slice(0, 80),
    org_name: String(form.get("org_name") ?? "").slice(0, 80),
    role: String(form.get("role") ?? "product"),
    default_mode: mode,
    onboarded: true,
  });
  redirect("/home");
}
