import Link from "next/link";
import { cn } from "@/lib/utils";

// ponytail: stand-in mark; swap for the official Architect/Lyzr SVG when available.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M9 23 16 8l7 15M11.8 17.5h8.4" className="stroke-background" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>Architect</span>
      <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">2.0</span>
    </Link>
  );
}
