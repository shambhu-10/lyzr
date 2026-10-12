"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/server";

export async function updateProfile(form: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({
    full_name: String(form.get("full_name") ?? "").slice(0, 80),
    org_name: String(form.get("org_name") ?? "").slice(0, 80),
    role: String(form.get("role") ?? "product"),
    default_mode: form.get("default_mode") === "developer" ? "developer" : "builder",
  }).eq("id", user.id);
  revalidatePath("/", "layout");
}

/** Provider tokens live in httpOnly cookies the browser can't clear, so sign-out removes them here. */
export async function clearProviderTokens() {
  const jar = await cookies();
  jar.delete("gh_token");
  jar.delete("gcal_token");
}

export async function setDefaultMode(mode: "builder" | "developer") {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({ default_mode: mode }).eq("id", user.id);
}
