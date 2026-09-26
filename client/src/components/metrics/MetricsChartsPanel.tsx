import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "../../lib/utils";
import { METRIC_SECTIONS, MONTHS, type MetricDef } from "@shared/metricsCatalog";
import { ChartLine } from "@phosphor-icons/react";

// A3: trend charts over the numbers founders already enter month by month.
// Reads the exact same query as MetricsKpiPanel (same key), so react-query
// serves both from one request, and the admin startup view gets charts for
// free through the shared apiBase prop.

interface MetricEntry { id: string; period: string; values: Record<string, number | string> }

// The chips founders most likely care about; everything else is in the picker.
const FEATURED_KEYS = ["rev_cumulative", "rev_mrr_b2b", "sales_burn_rate", "sales_paying_customers_b2c", "hr_team_size", "fund_investment_raised"];

const ALL_METRICS: (MetricDef & { section: string })[] = METRIC_SECTIONS.flatMap((s) =>
  s.metrics.map((m) => ({ ...m, section: s.title })),
);

/** "initial" sorts first, then YYYY-MM ascending (lexicographic works). */
function periodSort(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "initial") return -1;
  if (b === "initial") return 1;
  return a < b ? -1 : 1;
}

function shortLabel(period: string): string {
  if (period === "initial") return "Initial";
  const [y, m] = period.split("-");
  const name = MONTHS[Number(m) - 1]?.slice(0, 3) ?? period;
  // Only show the year when the data spans more than the current one.
  return `${name} ${y.slice(2)}`;
}

function toNumber(v: number | string | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function compact(n: number): string {
  return Math.abs(n) >= 1000 ? Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n) : String(n);
}

export function MetricsChartsPanel({ apiBase }: { apiBase: string }) {
  const { data } = useQuery<{ entries: MetricEntry[] }>({
    queryKey: ["metrics-panel", apiBase],
    queryFn: () => api(apiBase),
  });

  const [metricKey, setMetricKey] = useState("rev_cumulative");
  const metric = ALL_METRICS.find((m) => m.key === metricKey);

  // Which metrics have at least two data points (one point isn't a trend)?
  const plottableKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.entries ?? []) {
      for (const [k, v] of Object.entries(e.values)) {
        if (toNumber(v) !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([k]) => k));
  }, [data]);

  const points = useMemo(() => {
    const rows = (data?.entries ?? [])
      .map((e) => ({ period: e.period, value: toNumber(e.values[metricKey]) }))
      .filter((r): r is { period: string; value: number } => r.value !== null)
      .sort((a, b) => periodSort(a.period, b.period));
    return rows.map((r) => ({ ...r, label: shortLabel(r.period) }));
  }, [data, metricKey]);

  // Nothing plottable at all yet — stay out of the way entirely.
  if (plottableKeys.size === 0) return null;

  const money = metric?.unit === "money";
  const featured = ALL_METRICS.filter((m) => FEATURED_KEYS.includes(m.key) && (plottableKeys.has(m.key) || m.key === metricKey));

  return (
    <div className="ost-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-0">
        <h3 className="ost-card-title flex items-center gap-2 text-base">
          <ChartLine className="h-4 w-4 text-secondary" /> Trends
        </h3>
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="ost-input w-auto max-w-[260px] !py-1.5 text-sm"
          aria-label="Metric to chart"
        >
          {METRIC_SECTIONS.map((s) => (
            <optgroup key={s.key} label={s.title}>
              {s.metrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}{plottableKeys.has(m.key) ? "" : " (no data)"}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {featured.length > 1 && (
        <div className="flex flex-wrap gap-2 px-6 pt-3">
          {featured.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                m.key === metricKey ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-secondary/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-6 pt-4">
        {points.length >= 2 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF3D82" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF3D82" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis
                width={52}
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (money ? `$${compact(v)}` : compact(v))}
              />
              <Tooltip
                formatter={(v) => [money ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString(), metric?.label ?? metricKey]}
                contentStyle={{ borderRadius: 10, border: "1px solid #eef0f6", fontSize: 13 }}
              />
              <Area type="monotone" dataKey="value" stroke="#FF3D82" strokeWidth={2} fill="url(#trendFill)" dot={{ r: 3, fill: "#FF3D82" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            "{metric?.label ?? metricKey}" needs values in at least two periods before it can show a trend.
          </p>
        )}
      </div>
    </div>
  );
}
