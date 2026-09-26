import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonRows } from "../../components/Skeleton";
import { STAGE_LABELS, type StartupStage } from "../../lib/stageLabels";
import { Buildings as Building2, Clock, MagnifyingGlass, CaretUp, CaretDown, DownloadSimple as Download } from "@phosphor-icons/react";

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

// A4: sortable columns. Each getter returns the comparable/exported value.
const COLUMNS: { key: string; label: string; get: (r: Row) => string }[] = [
  { key: "companyName", label: "Startup", get: (r) => r.companyName ?? "" },
  { key: "owner", label: "Owner", get: (r) => r.ownerName ?? "" },
  { key: "location", label: "Location", get: (r) => r.location ?? "" },
  { key: "stage", label: "Stage", get: (r) => (r.stage ? STAGE_LABELS[r.stage as StartupStage] || r.stage : "") },
  { key: "status", label: "Status", get: (r) => (r.deletionRequestedAt ? "Deletion pending" : "Active") },
];

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function AdminStartups() {
  const [, navigate] = useLocation();
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const { data, isLoading } = useQuery<{ startups: Row[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const allRows = data?.startups ?? [];
  const rows = useMemo(() => {
    let out = stageFilter === "all" ? allRows : allRows.filter((r) => r.kysTrack === stageFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        [r.companyName, r.ownerName, r.ownerEmail, r.location].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const col = COLUMNS.find((c) => c.key === sort.key)!;
      out = [...out].sort((a, b) => sort.dir * col.get(a).localeCompare(col.get(b), undefined, { sensitivity: "base" }));
    }
    return out;
  }, [allRows, stageFilter, search, sort]);

  function toggleSort(key: string) {
    setSort((prev) => (prev?.key === key ? (prev.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  }

  // Client-side CSV of the currently filtered/sorted view.
  function exportCsv() {
    const header = [...COLUMNS.map((c) => c.label), "Owner email", "Track"];
    const lines = rows.map((r) => [...COLUMNS.map((c) => c.get(r)), r.ownerEmail ?? "", r.kysTrack ?? ""].map(csvCell).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `startups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="All startups"
          subtitle={`${rows.length} of ${allRows.length} total`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, owner, location…"
                  className="ost-input w-56 !py-1.5 pl-8 text-sm"
                  aria-label="Search startups"
                />
              </div>
              <button onClick={exportCsv} disabled={rows.length === 0} className="ost-btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-50">
                <Download className="h-4 w-4" /> CSV
              </button>
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
            </div>
          }
        />

        <div className="ost-card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-5 py-3 font-semibold">
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-primary">
                      {c.label}
                      {sort?.key === c.key && (sort.dir === 1 ? <CaretUp className="h-3 w-3" /> : <CaretDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows rows={5} cols={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-slate-400">{search || stageFilter !== "all" ? "No startups match this search or filter." : "No startups yet."}</td></tr>
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
