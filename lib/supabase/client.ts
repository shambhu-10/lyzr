import { createBrowserClient } from "@supabase/ssr";

import { clearProviderTokens } from "@/lib/actions/profile";

export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/** End the session and drop the GitHub / Google Calendar tokens kept for this user. */
export async function signOut() {
  await createClient().auth.signOut();
  await clearProviderTokens();
}
