import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { downloadXlsx } from "../../lib/xlsx";
import { Skeleton } from "../Skeleton";
import { METRIC_SECTIONS, monthPeriodsForYear, QUARTER_END_MONTH_INDEX, type MetricSection } from "@shared/metricsCatalog";
import { SECTION_ICONS, stripRomanNumeral } from "../../lib/metricsSectionIcons";
import { Download, ChartLineUp } from "@phosphor-icons/react";

interface MetricEntry { id: string; period: string; values: Record<string, number | string> }

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

function sectionIsEmpty(section: MetricSection, valueAt: (key: string, quarterIdx: number) => string): boolean {
  return section.metrics.every((m) => QUARTERS.every((_, i) => valueAt(m.key, i) === ""));
}

function SectionEmptyState({ section, addLabel, onAddData }: { section: MetricSection; addLabel: string; onAddData?: () => void }) {
  const Icon = SECTION_ICONS[section.key] ?? ChartLineUp;
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="flex h-16 w-24 items-center justify-center" style={{ background: "rgba(98,221,209,0.16)", borderRadius: "var(--r-pill)" }}>
        <Icon className="h-6 w-6" style={{ color: "var(--info)" }} />
      </div>
      <p className="text-sm" style={{ color: "var(--text-2)" }}>
        No {stripRomanNumeral(section.title).toLowerCase()} data yet for {new Date().getFullYear()}.
      </p>
      {onAddData && (
        <button onClick={onAddData} className="ost-btn-primary !px-4 !py-2 text-sm">
          {addLabel}
        </button>
      )}
    </div>
  );
}

/** Read-only quarter-end snapshot (Q1–Q4) of the Monthly Updates tab's metrics — one table per section. */
export function QuarterlySummaryPanel({
  apiBase,
  startupName,
  onSwitchToMonthly,
}: {
  apiBase: string;
  startupName?: string;
  onSwitchToMonthly?: () => void;
}) {
  const year = new Date().getFullYear();
  const periods = useMemo(() => monthPeriodsForYear(year), [year]);
  const currentQuarterLabel = QUARTERS[Math.floor(new Date().getMonth() / 3)];

  const { data, isLoading } = useQuery<{ entries: MetricEntry[] }>({
    queryKey: ["metrics-panel", apiBase],
    queryFn: () => api(apiBase),
  });

  const values = useMemo(() => {
    const next: Record<string, Record<string, string>> = {};
    for (const entry of data?.entries ?? []) {
      next[entry.period] = Object.fromEntries(
        Object.entries(entry.values).map(([k, v]) => [k, String(v)]),
      );
    }
    return next;
  }, [data]);

  function quarterValue(metricKey: string, quarterIdx: number): string {
    const period = periods[QUARTER_END_MONTH_INDEX[quarterIdx]];
    return values[period]?.[metricKey] ?? "";
  }

  async function exportSheet() {
    const header = ["Section", "Metric", ...QUARTERS];
    const rows: (string | number)[][] = [header];
    for (const section of METRIC_SECTIONS) {
      for (const metric of section.metrics) {
        rows.push([section.title, metric.label, ...QUARTERS.map((_, i) => quarterValue(metric.key, i))]);
      }
    }
    const namePart = startupName ? `${startupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-` : "";
    await downloadXlsx(`${namePart}quarterly-updates-${year}.xlsx`, "Quarterly Updates", rows, { mergeColumns: [0] });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Quarter-end snapshot of the Monthly Updates tab (March, June, September, December).</p>
        <button onClick={exportSheet} className="ost-btn-ghost !px-3 !py-2 text-sm">
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      {METRIC_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.key] ?? ChartLineUp;
        const empty = sectionIsEmpty(section, quarterValue);
        return (
          <div key={section.key} className="ost-card overflow-hidden">
            <div className="flex items-center gap-2.5 p-6 pb-4">
              <Icon className="h-6 w-6 shrink-0" style={{ color: "var(--info)" }} />
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-1)" }}>
                {stripRomanNumeral(section.title)}
              </h2>
            </div>
            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              {empty ? (
                <SectionEmptyState
                  section={section}
                  addLabel={`Add ${currentQuarterLabel} ${stripRomanNumeral(section.title).toLowerCase()} data`}
                  onAddData={onSwitchToMonthly}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-20 h-[46px] border-b bg-white" style={{ borderColor: "var(--border)" }}>
                        <th
                          className="sticky left-0 z-10 bg-white px-4 text-left text-xs font-semibold uppercase tracking-[0.08em]"
                          style={{ color: "var(--text-2)" }}
                        >
                          Metric
                        </th>
                        {QUARTERS.map((q) => (
                          <th key={q} className="px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-2)" }}>
                            {q}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.metrics.map((metric) => (
                        <tr key={metric.key} className="group h-[46px] border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                          <td
                            className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 align-middle font-medium group-hover:bg-[var(--bg-app)]"
                            style={{ color: "var(--text-1)" }}
                          >
                            {metric.label}
                          </td>
                          {QUARTERS.map((q, i) => {
                            const v = quarterValue(metric.key, i);
                            return (
                              <td key={q} className="px-4 text-right align-middle text-xs tabular-nums group-hover:bg-[var(--bg-app)]" style={{ color: "var(--text-2)" }}>
                                {v === "" ? <span style={{ color: "var(--text-3)" }}>—</span> : metric.unit === "money" ? `$${v}` : v}
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
          </div>
        );
      })}
    </div>
  );
}
