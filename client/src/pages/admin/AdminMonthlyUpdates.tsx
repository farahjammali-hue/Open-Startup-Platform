import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { MONTHLY_STATUS_LABELS, MONTHLY_STATUS_TONES, MONTH_NAMES, type MonthlyUpdateRow } from "../dashboard/types";
import { CalendarClock, LifeBuoy } from "lucide-react";

interface Update extends MonthlyUpdateRow {
  startupId: string;
  companyName: string;
}

export default function AdminMonthlyUpdates() {
  const [, navigate] = useLocation();
  const [attentionOnly, setAttentionOnly] = useState(false);
  const { data, isLoading } = useQuery<{ updates: Update[] }>({
    queryKey: ["admin-monthly-updates"],
    queryFn: () => api("/api/admin/monthly-updates"),
  });

  const all = data?.updates ?? [];
  const needsAttention = (u: Update) => u.status !== "on_track" || !!u.supportNeeded;
  const rows = attentionOnly ? all.filter(needsAttention) : all;

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Monthly updates"
          subtitle="Achieved / blocked / focus-next across every startup, most recent first."
          action={
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
              Needing attention only
            </label>
          }
        />

        <div className="mt-8 space-y-4">
          {isLoading ? (
            <SkeletonCards count={3} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title={attentionOnly ? "Nothing needs attention" : "No monthly updates yet"}
              description={attentionOnly ? "No at-risk, off-track, or support-requested updates right now." : "Monthly updates submitted by startups will show up here."}
            />
          ) : (
            rows.map((u) => {
              const flagged = needsAttention(u);
              return (
                <div
                  key={u.id}
                  onClick={() => navigate(`/admin/startups/${u.startupId}`)}
                  className={`ost-card cursor-pointer p-6 transition hover:-translate-y-0.5 hover:shadow-card-hover ${flagged ? "border-l-4 border-l-amber-400" : ""}`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-bold text-primary">{u.companyName}</span>
                      <span className="ml-2 text-xs text-slate-400">{MONTH_NAMES[u.periodMonth - 1]} {u.periodYear}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.supportNeeded && (
                        <StatusBadge tone="amber" icon={LifeBuoy}>Support requested</StatusBadge>
                      )}
                      <StatusBadge tone={MONTHLY_STATUS_TONES[u.status]}>{MONTHLY_STATUS_LABELS[u.status]}</StatusBadge>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <p className="text-slate-500"><b className="text-slate-600">Achieved:</b> {u.achieved}</p>
                    <p className="text-slate-500"><b className="text-slate-600">Blocked:</b> {u.blocked}</p>
                    <p className="text-slate-500"><b className="text-slate-600">Focus next:</b> {u.focusNext}</p>
                  </div>
                  {u.supportNeeded && (
                    <p className="mt-3 rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-text">
                      <b>Support needed:</b> {u.supportNeeded}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </AppShell>
  );
}
