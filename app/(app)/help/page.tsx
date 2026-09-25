import { BookOpen, GraduationCap, LifeBuoy, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const ITEMS = [
  { i: BookOpen, t: "Documentation", d: "How every feature works, for builders and developers." },
  { i: GraduationCap, t: "Lyzr University", d: "Free courses on designing and shipping agents." },
  { i: MessageCircle, t: "Community Discord", d: "Get help and share what you built." },
  { i: LifeBuoy, t: "Contact support", d: "A human replies within one business day." },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" description="Stuck? Pick the fastest way to get unstuck." />
      <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 md:px-10">
        {ITEMS.map((x) => (
          <a key={x.t} href="#" className="flex gap-4 rounded-xl border bg-card p-5 hover:border-foreground/20">
            <x.i className="size-5 text-brand" /><span><span className="block font-medium">{x.t}</span><span className="text-sm text-muted-foreground">{x.d}</span></span>
          </a>
        ))}
      </div>
    </>
  );
}
