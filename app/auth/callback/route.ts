import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).single();
  const res = NextResponse.redirect(`${origin}${profile?.onboarded ? safeNext : "/onboarding"}`);
  // GitHub token is only available right after sign-in; keep it server-side for listing repos on Import.
  if (data.session?.provider_token && data.user.app_metadata.provider === "github") {
    res.cookies.set("gh_token", data.session.provider_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  }
  return res;
}
