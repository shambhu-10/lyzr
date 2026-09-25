import { createClient } from "@/lib/supabase/client";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/** Real OAuth: ask Google for read-only calendar access, then come back to `next`. */
export async function connectGoogleCalendar(next: string, projectId?: string) {
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}&connect=google-calendar${projectId ? `&project=${projectId}` : ""}`;
  const options = { redirectTo, scopes: SCOPE, queryParams: { prompt: "consent", access_type: "online" } };
  const hasGoogle = data.user?.identities?.some((i) => i.provider === "google");
  // Same Google account → re-consent with the extra scope; email/GitHub users link Google instead of switching accounts.
  const { error } = hasGoogle ? await sb.auth.signInWithOAuth({ provider: "google", options }) : await sb.auth.linkIdentity({ provider: "google", options });
  return error?.message ?? null;
}
