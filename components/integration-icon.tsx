import { Globe } from "lucide-react";
import { siGithub, siGmail, siGooglecalendar, siGoogledrive, siGooglesheets, siHubspot, siLinear, siNotion, type SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

// Real brand marks (Simple Icons, CC0). Slack, Salesforce and Microsoft asked Simple Icons to remove theirs,
// so those keep a brand-coloured letter tile rather than a redrawn trademark.
const LOGOS: Record<string, SimpleIcon> = {
  "google-calendar": siGooglecalendar, gmail: siGmail, "google-drive": siGoogledrive, "google-sheets": siGooglesheets,
  hubspot: siHubspot, notion: siNotion, github: siGithub, linear: siLinear,
};

/** App-icon style tile for an integration: the real logo on white where we have it, otherwise a coloured initial. */
export function IntegrationIcon({ id, name, color, className }: { id: string; name: string; color: string; className?: string }) {
  const logo = LOGOS[id];
  if (logo)
    return (
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border border-black/5 bg-white shadow-sm", className)} title={name}>
        <svg viewBox="0 0 24 24" role="img" aria-label={name} className="size-[55%]" fill={`#${logo.hex}`}><path d={logo.path} /></svg>
      </span>
    );
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white", className)} style={{ background: color }} title={name} aria-label={name}>
      {id === "web-search" ? <Globe className="size-[50%]" /> : name[0]}
    </span>
  );
}
