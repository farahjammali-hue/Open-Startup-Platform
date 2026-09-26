import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../../components/PageHeader";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { MetricsKpiPanel } from "../../components/metrics/MetricsKpiPanel";
import { MetricsChartsPanel } from "../../components/metrics/MetricsChartsPanel";
import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";
import { InitialDataPanel, type InitialDataApiConfig } from "../../components/dashboard/InitialDataPanel";
import { Buildings as Building2, ChartLineUp as TrendingUp, ChartPieSlice as PieChart } from "@phosphor-icons/react";

interface Detail {
  startup: { id: string; companyName: string };
}

export default function AdminStartupDashboard() {
  const [, params] = useRoute("/admin/startups/:id/dashboard");
  const id = params?.id ?? "";
  const [tab, setTab] = useState<"initial" | "monthly" | "quarterly">("initial");

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["admin-startup-detail", id],
    queryFn: () => api(`/api/admin/startups/${id}`),
    enabled: !!id,
  });

  const adminConfig: InitialDataApiConfig = {
    getUrl: `/api/admin/startups/${id}/profile`,
    overviewPatchUrl: `/api/admin/startups/${id}/profile-overview`,
    teamUrl: `/api/admin/startups/${id}/team`,
    capTableUrl: `/api/admin/startups/${id}/cap-table`,
    subResourceBase: `/api/admin/startups/${id}`,
    metricsApiBase: `/api/admin/startups/${id}/metrics`,
  };

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup } = data;

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
        <PageHeader
          eyebrow="Administration · Dashboard"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Initial data, monthly metrics, and quarterly updates."
        />

        <TabBar
          tabs={[
            { key: "initial", label: "Initial Data" },
            { key: "monthly", label: "Monthly Updates" },
            { key: "quarterly", label: "Quarterly Updates" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "initial" && (
          <InitialDataPanel apiConfig={adminConfig} startupName={startup.companyName} />
        )}

        {tab === "monthly" && (
          <Section title="Metrics & KPIs" icon={TrendingUp}>
            <div className="space-y-6">
              <MetricsChartsPanel apiBase={`/api/admin/startups/${id}/metrics`} />
              <MetricsKpiPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={startup.companyName} />
            </div>
          </Section>
        )}

        {tab === "quarterly" && (
          <Section title="Quarterly updates" icon={PieChart}>
            <QuarterlySummaryPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={startup.companyName} onSwitchToMonthly={() => setTab("monthly")} />
          </Section>
        )}
      </main>
    </AppShell>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="ost-card mt-8 p-6">
      <h2 className="ost-card-title mb-4 flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-secondary" /> {title}
      </h2>
      {children}
    </div>
  );
}
