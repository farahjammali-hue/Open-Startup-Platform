import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "../../lib/utils";
import { MONTHS } from "@shared/metricsCatalog";
import { ChartLine } from "@phosphor-icons/react";

// A11: the whole portfolio in one chart — monthly sums across every real
// startup's saved metrics, from /api/admin/portfolio-metrics.

interface SeriesRow {
  period: string; // YYYY-MM
  reporting: number;
  revCumulative: number;
  mrr: number;
  burn: number;
  teamSize: number;
}

const METRICS = [
  { key: "revCumulative", label: "Cumulative revenue", money: true },
  { key: "mrr", label: "MRR (B2B + B2C)", money: true },
  { key: "burn", label: "Burn rate", money: true },
  { key: "teamSize", label: "Total team size", money: false },
  { key: "reporting", label: "Startups reporting", money: false },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

function shortLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTHS[Number(m) - 1]?.slice(0, 3) ?? period} ${y.slice(2)}`;
}

function compact(n: number): string {
  return Math.abs(n) >= 1000 ? Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n) : String(n);
}

export function PortfolioTrends() {
  const [metric, setMetric] = useState<MetricKey>("revCumulative");
  const { data } = useQuery<{ series: SeriesRow[] }>({
    queryKey: ["admin-portfolio-metrics"],
    queryFn: () => api("/api/admin/portfolio-metrics"),
  });
  const series = data?.series ?? [];
  if (series.length < 2) return null; // nothing worth charting yet

  const def = METRICS.find((m) => m.key === metric)!;
  const points = series.map((r) => ({ label: shortLabel(r.period), value: r[metric] }));

  return (
    <div className="ost-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-2">
        <h2 className="ost-card-title flex items-center gap-2 text-base">
          <ChartLine className="h-4 w-4 text-secondary" /> Portfolio trends
        </h2>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                m.key === metric ? "border-secondary bg-secondary/10 text-secondary" : "border-slate-200 text-slate-500 hover:border-secondary/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF3D82" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#FF3D82" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis width={52} tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (def.money ? `$${compact(v)}` : compact(v))} />
            <Tooltip
              formatter={(v) => [def.money ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString(), def.label]}
              contentStyle={{ borderRadius: 10, border: "1px solid #eef0f6", fontSize: 13 }}
            />
            <Area type="monotone" dataKey="value" stroke="#FF3D82" strokeWidth={2} fill="url(#portfolioFill)" dot={{ r: 3, fill: "#FF3D82" }} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-slate-400">Sums across every startup that saved metrics for that month.</p>
      </div>
    </div>
  );
}
