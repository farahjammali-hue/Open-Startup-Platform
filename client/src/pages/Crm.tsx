import { useLocation } from "wouter";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { CrmPanel } from "../components/crm/CrmPanel";
import { useKysStatus } from "../lib/kysStatus";
import { Lock } from "lucide-react";

export default function Crm() {
  const [, navigate] = useLocation();
  const { kysSubmitted, isLoading: kysLoading } = useKysStatus();

  if (kysLoading) return null;

  if (!kysSubmitted) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink />
          <PageHeader eyebrow="Program tools" title="CRM" subtitle="Track your investors, clients, and partners in one place." />
          <div className="mt-8">
            <EmptyState
              icon={Lock}
              title="Complete your KYC to unlock the CRM"
              description="Finish your Contract & KYS submission to access this tool."
              actionLabel="Go to Contract & KYS"
              onAction={() => navigate("/contract-kys")}
            />
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Program tools" title="CRM" subtitle="Track your investors, clients, and partners in one place." />
        <div className="mt-8">
          <CrmPanel apiBase="/api/crm" />
        </div>
      </main>
    </AppShell>
  );
}
