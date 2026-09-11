import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { downloadXlsx } from "../../lib/xlsx";
import { Skeleton } from "../Skeleton";
import { METRIC_SECTIONS, monthPeriodsForYear, QUARTER_END_MONTH_INDEX } from "@shared/metricsCatalog";
import { Download } from "lucide-react";

interface MetricEntry { id: string; period: string; values: Record<string, number | string> }

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

/** Read-only quarter-end snapshot (Q1–Q4) of the Monthly Updates tab's metrics — one table per section. */
export function QuarterlySummaryPanel({ apiBase, startupName }: { apiBase: string; startupName?: string }) {
  const year = new Date().getFullYear();
  const periods = useMemo(() => monthPeriodsForYear(year), [year]);

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

  function exportSheet() {
    const header = ["Section", "Metric", ...QUARTERS];
    const rows: (string | number)[][] = [header];
    for (const section of METRIC_SECTIONS) {
      for (const metric of section.metrics) {
        rows.push([section.title, metric.label, ...QUARTERS.map((_, i) => quarterValue(metric.key, i))]);
      }
    }
    const namePart = startupName ? `${startupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-` : "";
    downloadXlsx(`${namePart}quarterly-updates-${year}.xlsx`, "Quarterly Updates", rows, { mergeColumns: [0] });
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

      {METRIC_SECTIONS.map((section) => (
        <div key={section.key} className="ost-card overflow-hidden">
          <div className="p-6 pb-4">
            <h3 className="ost-card-title text-base">{section.title}</h3>
          </div>
          <div className="border-t border-slate-100 p-6 pt-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="sticky left-0 z-10 bg-white py-2 pr-4 font-semibold">Metric</th>
                    {QUARTERS.map((q) => <th key={q} className="py-2 px-2 font-semibold">{q}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {section.metrics.map((metric) => (
                    <tr key={metric.key} className="border-b border-slate-50 last:border-0">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pr-4 font-medium text-primary">{metric.label}</td>
                      {QUARTERS.map((q, i) => {
                        const v = quarterValue(metric.key, i);
                        return (
                          <td key={q} className="px-2 py-1.5 text-xs tabular-nums text-slate-600">
                            {v === "" ? <span className="text-slate-300">—</span> : metric.unit === "money" ? `$${v}` : v}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
