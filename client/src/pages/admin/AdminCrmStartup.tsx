import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { CrmPanel } from "../../components/crm/CrmPanel";

interface StartupBasic {
  id: string;
  companyName: string;
}

export default function AdminCrmStartup() {
  // Two entry points: nested under the startup's admin page, or flat from the
  // CRM overview. Back goes to wherever we came in from.
  const [fromStartupPage, nested] = useRoute("/admin/startups/:startupId/crm");
  const [, flat] = useRoute("/admin/crm/:startupId");
  const startupId = (fromStartupPage ? nested?.startupId : flat?.startupId) ?? "";

  const { data } = useQuery<{ startup: StartupBasic }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to={fromStartupPage ? `/admin/startups/${startupId}` : "/admin/crm"} label={fromStartupPage ? `Back to ${data?.startup?.companyName ?? "the startup"}` : "Back to CRM"} />
        <PageHeader
          eyebrow="Administration"
          title={data?.startup?.companyName ?? "CRM"}
          subtitle="Investors, clients, and partners for this startup."
        />

        <div className="mt-8">
          {startupId && <CrmPanel apiBase={`/api/admin/startups/${startupId}/crm`} />}
        </div>
      </main>
    </AppShell>
  );
}
