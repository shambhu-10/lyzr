import { createBrowserClient } from "@supabase/ssr";
import { clearProviderTokens } from "@/lib/actions/profile";

export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/** GitHub with repo access (list repos, push code). An already-linked account re-auths to get a fresh token. */
export async function connectGitHub(next: string) {
  const sb = createClient();
  const options = { redirectTo: `${location.origin}/auth/callback?provider=github&next=${encodeURIComponent(next)}`, scopes: "repo read:user" };
  const { error } = await sb.auth.linkIdentity({ provider: "github", options });
  if (error) await sb.auth.signInWithOAuth({ provider: "github", options });
}

/** End the session and drop the GitHub / Google Calendar tokens kept for this user. */
export async function signOut() {
  await createClient().auth.signOut();
  await clearProviderTokens();
}
