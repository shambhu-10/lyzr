import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  // Already signed in (e.g. a transient refresh hiccup sent you here): go straight back.
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user && !error) redirect(safeNext);
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col px-6 py-8 md:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Architect</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account — it&apos;s the same step.</p>
          <LoginForm next={typeof next === "string" ? next : "/home"} error={typeof error === "string" ? error : undefined} />
          <p className="mt-8 text-xs text-muted-foreground">By continuing you agree to the Terms and Privacy Policy. We never post or email on your behalf without asking.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-card md:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_20%,var(--brand-soft),transparent)]" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md font-display text-3xl leading-snug">
            “I described the tool I needed on Monday. By lunch it was reading my real calendar.”
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">— The experience we&apos;re designing for</p>
        </div>
      </div>
    </div>
  );
}
