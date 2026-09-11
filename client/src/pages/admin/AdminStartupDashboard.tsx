import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { GOAL_STATUS_LABELS, GOAL_STATUS_TONES, type Goal } from "../dashboard/types";
import { MetricsKpiPanel } from "../../components/metrics/MetricsKpiPanel";
import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";
import { InitialDataPanel, type InitialDataApiConfig } from "../../components/dashboard/InitialDataPanel";
import { Building2, Target, Inbox, TrendingUp, PieChart } from "lucide-react";

interface Detail {
  startup: { id: string; companyName: string };
  goals: Goal[];
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

  const { startup, goals } = data;

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
          <>
            <InitialDataPanel apiConfig={adminConfig} />

            <Section title="Objectives" icon={Target}>
              {goals.length === 0 ? <EmptyRow text="No objectives set yet." /> : (
                <div className="space-y-2">
                  {goals.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{g.title}</div>
                        {g.targetDate && <div className="text-xs text-slate-400">Target: {new Date(g.targetDate).toLocaleDateString()}</div>}
                      </div>
                      <StatusBadge tone={GOAL_STATUS_TONES[g.status]}>{GOAL_STATUS_LABELS[g.status]}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === "monthly" && (
          <Section title="Metrics & KPIs" icon={TrendingUp}>
            <MetricsKpiPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={startup.companyName} />
          </Section>
        )}

        {tab === "quarterly" && (
          <Section title="Quarterly updates" icon={PieChart}>
            <QuarterlySummaryPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={startup.companyName} />
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

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
      <Inbox className="h-4 w-4" /> {text}
    </div>
  );
}
