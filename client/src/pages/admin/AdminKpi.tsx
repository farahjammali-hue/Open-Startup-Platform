import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton } from "../../components/Skeleton";
import { KPI_PHASES, KPI_PHASE_LABELS, KPI_PHASE_SHORT_LABELS, type KpiPhase } from "../../lib/kpiPhases";
import { formatMoney } from "../../lib/format";
import { LineChart } from "lucide-react";

interface Submission {
  id: string; startupId: string; phase: KpiPhase;
  revenue: number | null; activeUsers: number | null; newCustomers: number | null;
  burnRate: number | null; cashOnHand: number | null; teamSize: number | null; runwayMonths: number | null;
  companyName: string | null;
}
interface StartupRow { id: string; companyName: string }

export default function AdminKpi() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<KpiPhase>(KPI_PHASES[0]);
  const { data, isLoading } = useQuery<{ submissions: Submission[]; startups: StartupRow[] }>({
    queryKey: ["admin-kpi"],
    queryFn: () => api("/api/admin/kpi"),
  });

  const submissions = data?.submissions ?? [];
  const startups = data?.startups ?? [];
  const byKey = new Map(submissions.map((s) => [`${s.startupId}:${s.phase}`, s]));
  // Submissions whose startup no longer exists (orphaned FK, pre-existing data
  // issue) are meaningless here — the portfolio matrix above is keyed off the
  // live startups list, so they only need excluding from this flat table.
  const phaseRows = submissions
    .filter((s) => s.phase === phase && s.companyName)
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="KPI submissions"
          subtitle="Track submission coverage and compare metrics across the portfolio."
        />

        <div className="ost-card mt-8 overflow-hidden">
          <h2 className="ost-card-title p-6 pb-0 text-base">Submission coverage</h2>
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : startups.length === 0 ? (
            <EmptyState icon={LineChart} title="No startups yet" description="KPI coverage will show up here once startups exist." />
          ) : (
            <div className="overflow-x-auto p-6 pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Startup</th>
                    {KPI_PHASES.map((p) => (
                      <th key={p} className="py-2 pr-4 font-semibold">{KPI_PHASE_SHORT_LABELS[p]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {startups.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/startups/${s.id}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-2 pr-4 font-semibold text-primary">{s.companyName}</td>
                      {KPI_PHASES.map((p) => {
                        const sub = byKey.get(`${s.id}:${p}`);
                        return (
                          <td key={p} className="py-2 pr-4 tabular-nums">
                            {sub ? <span className="text-secondary">{formatMoney(sub.revenue)}</span> : <span className="text-slate-300">Missing</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ost-card mt-8 overflow-hidden">
          <div className="p-6 pb-0">
            <h2 className="ost-card-title text-base">Compare by phase</h2>
          </div>
          <div className="px-6">
            <TabBar tabs={KPI_PHASES.map((p) => ({ key: p, label: KPI_PHASE_LABELS[p] }))} active={phase} onChange={setPhase} />
          </div>
          <div className="overflow-x-auto px-6 pb-6">
            {phaseRows.length === 0 ? (
              <p className="text-sm text-slate-400">No submissions for this phase yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Startup</th>
                    <th className="py-2 pr-4 font-semibold">Revenue</th>
                    <th className="py-2 pr-4 font-semibold">Active users</th>
                    <th className="py-2 pr-4 font-semibold">New customers</th>
                    <th className="py-2 pr-4 font-semibold">Burn rate</th>
                    <th className="py-2 pr-4 font-semibold">Cash on hand</th>
                    <th className="py-2 pr-4 font-semibold">Team size</th>
                    <th className="py-2 pr-4 font-semibold">Runway (mo)</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseRows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/admin/startups/${r.startupId}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-2 pr-4 font-semibold text-primary">{r.companyName || "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(r.revenue)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{r.activeUsers ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{r.newCustomers ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(r.burnRate)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(r.cashOnHand)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{r.teamSize ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{r.runwayMonths ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
