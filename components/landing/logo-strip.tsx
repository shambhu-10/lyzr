import { siClerk, siGithub, siGmail, siGooglecalendar, siGoogledrive, siGooglesheets, siHubspot, siLangchain, siLinear, siNeon, siNextdotjs, siNotion, siSupabase, siVite, type SimpleIcon } from "simple-icons";

// Only tools Architect connects to or builds on (Simple Icons, CC0). Slack/Salesforce/Microsoft/OpenAI aren't in the set by their owners' request.
const LOGOS: SimpleIcon[] = [siGooglecalendar, siGmail, siGoogledrive, siGooglesheets, siHubspot, siNotion, siGithub, siLinear, siSupabase, siNeon, siClerk, siNextdotjs, siVite, siLangchain];

/** Quiet, monochrome row of logos; each takes its brand colour on hover (near-black brands use the text colour so dark mode works). */
export function LogoStrip() {
  return (
    <div aria-label="Works with" className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-3">
      <span className="text-xs text-muted-foreground">Works with</span>
      <ul className="flex max-w-[15rem] flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:max-w-none">
        {LOGOS.map((i) => {
          const dark = parseInt(i.hex.slice(0, 2), 16) + parseInt(i.hex.slice(2, 4), 16) + parseInt(i.hex.slice(4, 6), 16) < 120;
          return (
            <li key={i.slug} title={i.title}>
              <svg role="img" aria-label={i.title} viewBox="0 0 24 24" style={dark ? undefined : ({ "--brand-hex": `#${i.hex}` } as React.CSSProperties)}
                className={`size-[18px] fill-current text-foreground/30 transition-colors duration-300 ${dark ? "hover:text-foreground" : "hover:text-(--brand-hex)"}`}>
                <path d={i.path} />
              </svg>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
