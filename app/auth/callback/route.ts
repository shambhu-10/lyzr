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

  // Real Google Calendar connection: re-consent with calendar.readonly returns a short-lived access token.
  const connect = searchParams.get("connect");
  const projectId = searchParams.get("project");
  if (connect === "google-calendar" && data.session?.provider_token) {
    if (projectId) {
      const { data: p } = await supabase.from("projects").select("connections").eq("id", projectId).single();
      if (p) {
        const connections = { ...(p.connections as Record<string, string>), "google-calendar": "connected" };
        await supabase.from("projects").update({ connections, demo_data: Object.values(connections).includes("sample") }).eq("id", projectId);
      }
    }
    const { data: prof } = await supabase.from("profiles").select("connections").eq("id", data.user.id).single();
    await supabase.from("profiles").update({ connections: { ...(prof?.connections ?? {}), "google-calendar": new Date().toISOString() } }).eq("id", data.user.id);
    const res = NextResponse.redirect(`${origin}${safeNext}`);
    // ponytail: access token only (~1h); add refresh-token exchange with our own Google client secret for long-lived access.
    res.cookies.set("gcal_token", data.session.provider_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 55 * 60 });
    return res;
  }

  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", data.user.id).single();
  const res = NextResponse.redirect(`${origin}${profile?.onboarded ? safeNext : "/onboarding"}`);
  // GitHub token is only available right after sign-in; keep it server-side for listing repos on Import.
  if (data.session?.provider_token && data.user.app_metadata.provider === "github") {
    res.cookies.set("gh_token", data.session.provider_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  }
  return res;
}
