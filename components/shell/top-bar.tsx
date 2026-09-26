import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditsMenu } from "./credits-menu";
import { UserMenu } from "./user-menu";

/** Top-right of every app page: credits, theme, profile (the logo shows here on phones, where there's no sidebar). */
export function TopBar({ name, email, credits }: { name: string; email: string; credits: number }) {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-background/80 px-4 backdrop-blur-md md:justify-end">
      <div className="md:hidden"><Logo href="/home" /></div>
      <div className="flex items-center gap-2">
        <CreditsMenu credits={credits} />
        <ThemeToggle />
        <UserMenu name={name} email={email} />
      </div>
    </div>
  );
}
