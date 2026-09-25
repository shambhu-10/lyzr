/** Markdown-lite for AI output: **bold**, _italic_, `code`, ``` fences, "- " bullets, "#" headings. No dependency, no HTML injection. */
function inline(t: string) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_\s][^_]*_)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b>
      : p.startsWith("`") && p.endsWith("`") ? <code key={i} className="rounded bg-black/5 px-1 font-mono text-[0.92em]">{p.slice(1, -1)}</code>
      : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
      : <span key={i}>{p}</span>,
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const out: React.ReactNode[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimEnd();
    if (l.trim().startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      out.push(<pre key={i} className="my-1 overflow-x-auto rounded-lg bg-black/5 p-2.5 font-mono text-xs whitespace-pre-wrap">{code.join("\n").trim()}</pre>);
    } else if (!l.trim()) out.push(<div key={i} className="h-2" />);
    else if (/^#{1,3} /.test(l)) out.push(<div key={i} className="mt-2 font-semibold">{inline(l.replace(/^#+ /, ""))}</div>);
    else if (/^\s*([-*•]|\d+\.) /.test(l)) out.push(<div key={i} className="flex gap-2 pl-1"><span className="opacity-50">•</span><span>{inline(l.replace(/^\s*([-*•]|\d+\.) /, ""))}</span></div>);
    else out.push(<p key={i}>{inline(l)}</p>);
  }
  return <div className={className}>{out}</div>;
}
