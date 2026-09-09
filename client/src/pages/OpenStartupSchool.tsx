import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/EmptyState";
import { BackLink, PageHeader } from "../components/PageHeader";
import { FileText } from "lucide-react";

export default function OpenStartupSchool() {
  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="The learning road" title="Open Startup School" subtitle="Program docs and resources." />

        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title="Docs coming soon"
            description="The Open Startup School curriculum is being reworked. Documentation and resources will be linked here shortly."
          />
        </div>
      </main>
    </AppShell>
  );
}
