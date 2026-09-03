import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonRows } from "../../components/Skeleton";
import { STAGE_LABELS, type StartupStage } from "../../lib/stageLabels";
import { Building2, Clock } from "lucide-react";

interface Row {
  id: string; companyName: string; website: string | null;
  location: string | null; stage: string | null; logoUrl: string | null;
  deletionRequestedAt: string | null; ownerName: string | null; ownerEmail: string | null;
  kysTrack: "pre_seed" | "seed" | null;
}

const STAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "seed", label: "Seed" },
  { key: "pre_seed", label: "Pre-Seed" },
] as const;
type StageFilter = (typeof STAGE_FILTERS)[number]["key"];

export default function AdminStartups() {
  const [, navigate] = useLocation();
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const { data, isLoading } = useQuery<{ startups: Row[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const allRows = data?.startups ?? [];
  const rows = stageFilter === "all" ? allRows : allRows.filter((r) => r.kysTrack === stageFilter);

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="All startups"
          subtitle={`${rows.length} of ${allRows.length} total`}
          action={
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
              {STAGE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStageFilter(f.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    stageFilter === f.key ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />

        <div className="ost-card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Startup</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Location</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-slate-400">{stageFilter === "all" ? "No startups yet." : "No startups match this filter."}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/admin/startups/${r.id}`)}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                        ) : (
                          <Building2 className="h-4 w-4 text-secondary" />
                        )}
                        <span className="font-semibold text-primary">{r.companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <div>{r.ownerName}</div>
                      <div className="text-xs text-slate-400">{r.ownerEmail}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{r.location || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{r.stage ? STAGE_LABELS[r.stage as StartupStage] || r.stage : "—"}</td>
                    <td className="px-5 py-3">
                      {r.deletionRequestedAt ? (
                        <StatusBadge tone="amber" icon={Clock}>Deletion pending</StatusBadge>
                      ) : (
                        <span className="text-xs font-medium text-secondary">Active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
