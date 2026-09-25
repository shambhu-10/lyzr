import { PageHeader } from "@/components/page-header";
import { Importer } from "@/components/import/importer";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import a project" description="Keep working on code you already have. Architect detects your stack and agents, and never rewrites your code without asking." />
      <div className="px-6 py-6 md:px-10"><Importer /></div>
    </>
  );
}
