"use client";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z" />
      <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8L6 14.3z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1c.9-2.6 3.2-4.7 6-4.7z" />
    </svg>
  );
}

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState(error ? "Sign-in didn't complete. Please try again." : "");
  const redirectTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const oauth = async (provider: "google" | "github") => {
    setBusy(provider);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo(), scopes: provider === "github" ? "read:user" : undefined },
    });
    if (error) { setMsg(error.message); setBusy(null); }
  };

  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(null);
    if (error) setMsg(error.message);
    else setSent(true);
  };

  if (sent)
    return (
      <div className="mt-8 rounded-xl border bg-card p-5">
        <Mail className="size-5 text-brand" />
        <p className="mt-3 font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">We sent a sign-in link to <b>{email}</b>. You can close this tab.</p>
        <button onClick={() => setSent(false)} className="mt-4 text-sm underline underline-offset-4">Use a different email</button>
      </div>
    );

  return (
    <div className="mt-8 space-y-3">
      <Button variant="outline" size="lg" className="h-11 w-full" onClick={() => oauth("google")} disabled={!!busy}>
        {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />} Continue with Google
      </Button>
      <Button variant="outline" size="lg" className="h-11 w-full" onClick={() => oauth("github")} disabled={!!busy}>
        {busy === "github" ? <Loader2 className="animate-spin" /> : <GithubIcon />} Continue with GitHub
      </Button>
      <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={magic} className="space-y-3">
        <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" aria-label="Email" />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={!!busy}>
          {busy === "email" && <Loader2 className="animate-spin" />} Email me a sign-in link
        </Button>
      </form>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
