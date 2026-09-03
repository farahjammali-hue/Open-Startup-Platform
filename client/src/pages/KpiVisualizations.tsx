import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/EmptyState";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { KPI_PHASE_SHORT_LABELS, type KpiPhase } from "../lib/kpiPhases";
import { KPI_SECTIONS, KPI_FIELD_TO_COLUMN } from "../lib/kpiSections";
import { formatNumber } from "../lib/format";
import { Info, BarChart3 } from "lucide-react";

interface KpiSubmission {
  id: string;
  phase: KpiPhase;
  revenue: number | null;
  activeUsers: number | null;
  newCustomers: number | null;
  burnRate: number | null;
  cashOnHand: number | null;
  teamSize: number | null;
  runwayMonths: number | null;
  metrics: Record<string, unknown> | null;
}

// Reads a KPI value by its form field label: typed columns (revenue,
// activeUsers, etc.) first, falling back to the flexible `metrics` JSON
// blob that holds the other ~40 fields from the KPI collection form.
function metricValue(s: KpiSubmission, fieldLabel: string): number {
  const column = KPI_FIELD_TO_COLUMN[fieldLabel];
  if (column) return Number((s as unknown as Record<string, unknown>)[column] ?? 0);
  return Number(s.metrics?.[fieldLabel] ?? 0) || 0;
}

type ChartMetric = { title: string; field: string; money?: boolean; suffix?: string };
type DeepDiveSection =
  | { title: string; type: "chart"; metrics: ChartMetric[] }
  | { title: string; type: "snapshot"; fields: string[] };

// The "most relevant" slice of each KPI form section: fields with a genuine
// numeric trend become charts; sections that are entirely qualitative
// (startup profile, IP) show the latest submitted values instead, since
// there's nothing meaningful to plot over time.
const DEEPDIVE_SECTIONS: DeepDiveSection[] = [
  { title: KPI_SECTIONS[0].title, type: "snapshot", fields: ["Sector / Industry", "Business Model", "Incorporation status", "Countries of Operation"] },
  { title: KPI_SECTIONS[1].title, type: "chart", metrics: [
    { title: "Technology Readiness Level (TRL)", field: "Technology Readiness Level (TRL)" },
  ] },
  { title: KPI_SECTIONS[2].title, type: "snapshot", fields: ["Patent status", "IP Ownership Strategy"] },
  { title: KPI_SECTIONS[3].title, type: "chart", metrics: [
    { title: "Team size", field: "Number of Employees" },
    { title: "Full-time employees", field: "Number of Full-Time Employees" },
    { title: "Female employees in leadership", field: "Number of Female Employees in Leadership" },
  ] },
  { title: KPI_SECTIONS[4].title, type: "chart", metrics: [
    { title: "Amount fundraised to date", field: "Amount Fundraised to Date", money: true },
    { title: "Venture capital funding", field: "Venture Capital Funding", money: true },
    { title: "Target size of current round", field: "Total Target Size of Current Round", money: true },
  ] },
  { title: KPI_SECTIONS[5].title, type: "chart", metrics: [
    { title: "Revenue", field: "Revenue Since Establishment", money: true },
    { title: "Active / paying customers", field: "Paying Customers / Active Users" },
    { title: "Annual recurring revenue (ARR)", field: "Annual Recurring Revenue (ARR)", money: true },
    { title: "Burn rate", field: "Burn Rate", money: true },
    { title: "Gross margin (%)", field: "Gross Margin (%)", suffix: "%" },
  ] },
];

const TABS = ["overview", "deepdive", "benchmarks"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { overview: "Overview", deepdive: "Deep dive", benchmarks: "Cohort benchmarks" };

export default function KpiVisualizations() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const { data } = useQuery<{ submissions: KpiSubmission[] }>({ queryKey: ["kpis"], queryFn: () => api("/api/kpis") });
  const submissions = data?.submissions ?? [];
  const latest = submissions[submissions.length - 1];
  const prev = submissions[submissions.length - 2];

  const headline = [
    { label: "Revenue", value: latest?.revenue ?? 0, prevValue: prev?.revenue ?? 0, money: true },
    { label: "Active users", value: latest?.activeUsers ?? 0, prevValue: prev?.activeUsers ?? 0 },
    { label: "Runway", value: latest?.runwayMonths ?? 0, prevValue: prev?.runwayMonths ?? 0, suffix: " mo" },
  ];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Program tools" title="KPI visualizations" subtitle="Charts built from your submitted KPI data, updated after each phase." />

        <TabBar tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t] }))} active={tab} onChange={setTab} />

        {submissions.length === 0 && (
          <div className="mt-6">
            <EmptyState
              icon={BarChart3}
              title="No KPI submissions yet"
              description="Submit your Program entry phase from the Dashboard's KPI collection tab to see charts here."
              actionLabel="Go to Dashboard"
              onAction={() => navigate("/dashboard")}
            />
          </div>
        )}

        {submissions.length > 0 && tab === "overview" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {headline.map((h) => {
                const delta = h.value - h.prevValue;
                return (
                  <div key={h.label} className="ost-card p-6">
                    <div className="ost-helper-text font-bold uppercase tracking-wide">{h.label}</div>
                    <div className="mt-2 text-xl font-extrabold text-primary">{formatNumber(h.value, { money: h.money, suffix: h.suffix })}</div>
                    <div className={`mt-1 text-xs font-semibold ${delta > 0 ? "text-turq-text" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                      {delta === 0 ? "No change vs previous phase" : `${delta > 0 ? "+" : ""}${delta.toLocaleString()} vs previous phase`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <TrendChart title="Revenue" submissions={submissions} valueFn={(s) => s.revenue ?? 0} money />
              <TrendChart title="Active users" submissions={submissions} valueFn={(s) => s.activeUsers ?? 0} />
              <TrendChart title="Runway (months)" submissions={submissions} valueFn={(s) => s.runwayMonths ?? 0} />
              <TrendChart title="Team size" submissions={submissions} valueFn={(s) => s.teamSize ?? 0} />
            </div>
          </div>
        )}

        {submissions.length > 0 && tab === "deepdive" && <div className="mt-6"><DeepDive submissions={submissions} /></div>}

        {tab === "benchmarks" && (
          <div className="mt-6 flex items-start gap-4 rounded-lg bg-turq-bg p-4 text-sm text-turq-text">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              Cohort benchmarks need at least 3 other startups to have submitted the same phase before an average can be shown anonymously. Benchmarks are pending for most KPIs while the cohort is early.
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function TrendChart({ title, submissions, valueFn, money, suffix }: { title: string; submissions: KpiSubmission[]; valueFn: (s: KpiSubmission) => number; money?: boolean; suffix?: string }) {
  const points = submissions.map((s) => ({ label: KPI_PHASE_SHORT_LABELS[s.phase], value: valueFn(s) }));
  const max = Math.max(1, ...points.map((p) => p.value));
  const latestVal = points[points.length - 1]?.value ?? 0;

  return (
    <div className="ost-card p-6">
      <div className="mb-3 flex items-start justify-between">
        <span className="text-sm font-bold text-primary">{title}</span>
        <span className="text-lg font-extrabold text-primary">{formatNumber(latestVal, { money, suffix })}</span>
      </div>
      <div className="relative h-24">
        {/* Recessive gridlines at 50% and 100% of the scale, hairline and unlabeled — the header figure and per-bar tooltip already carry the values. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-slate-100" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-100" />
        <div
          className="relative flex h-full items-end gap-2"
          role="img"
          aria-label={`${title} by phase: ${points.map((p) => `${p.label} ${formatNumber(p.value, { money, suffix })}`).join(", ")}`}
        >
          {points.map((p, i) => (
            <div key={i} className="group relative flex flex-1 flex-col items-center">
              <div
                tabIndex={0}
                className="w-full rounded-t-[4px] bg-secondary-500 outline-none transition group-hover:brightness-110 focus-visible:ring-2 focus-visible:ring-secondary-500/50"
                style={{ height: `${Math.max(4, (p.value / max) * 88)}px` }}
              />
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white shadow-card-hover group-hover:block group-focus-within:block"
              >
                {p.label}: {formatNumber(p.value, { money, suffix })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between ost-helper-text">
        {points.map((p, i) => <span key={i}>{p.label}</span>)}
      </div>
      <table className="sr-only">
        <caption>{title} by program phase</caption>
        <thead><tr><th>Phase</th><th>Value</th></tr></thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}><td>{p.label}</td><td>{formatNumber(p.value, { money, suffix })}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeepDive({ submissions }: { submissions: KpiSubmission[] }) {
  const latest = submissions[submissions.length - 1];
  return (
    <div className="space-y-10">
      {DEEPDIVE_SECTIONS.map((sec) => (
        <div key={sec.title}>
          <div className="mb-4 flex items-center gap-3 ost-section-label">
            <span>{sec.title}</span><span className="h-px flex-1 bg-white/10" />
          </div>
          {sec.type === "chart" ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {sec.metrics.map((m) => (
                <TrendChart key={m.field} title={m.title} submissions={submissions} valueFn={(s) => metricValue(s, m.field)} money={m.money} suffix={m.suffix} />
              ))}
            </div>
          ) : (
            <div className="ost-card grid gap-4 p-6 sm:grid-cols-2">
              {sec.fields.map((f) => (
                <div key={f}>
                  <div className="ost-helper-text font-bold uppercase tracking-wide">{f}</div>
                  <div className="mt-1 text-sm font-semibold text-primary">{(latest?.metrics?.[f] as string) || "Not yet submitted"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
