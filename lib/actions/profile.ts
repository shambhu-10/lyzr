"use server";
import { revalidatePath } from "next/cache";
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

export async function setDefaultMode(mode: "builder" | "developer") {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({ default_mode: mode }).eq("id", user.id);
}
