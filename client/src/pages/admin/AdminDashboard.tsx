import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Users, Rocket, Trash2, ArrowRight, FileSignature, LineChart, CalendarClock, FolderLock, UsersRound, Contact, GraduationCap } from "lucide-react";

interface Stats {
  users: number; startups: number; pendingDeletions: number;
  pendingContracts: number; pendingKys: number; kpiSubmissions: number;
  monthlyUpdatesNeedingAttention: number; pendingDocuments: number; upcomingMentorshipSessions: number;
  teamMembers: number; trainings: number;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => api("/api/admin/stats"),
  });

  const pendingReviews = (data?.pendingContracts ?? 0) + (data?.pendingKys ?? 0);

  const cards = [
    { label: "Users", value: data?.users, icon: Users, to: "/admin/users" },
    { label: "Startups", value: data?.startups, icon: Rocket, to: "/admin/startups" },
    { label: "Pending deletions", value: data?.pendingDeletions, icon: Trash2, to: "/admin/deletion-requests" },
    { label: "Contracts & KYS to review", value: pendingReviews, icon: FileSignature, to: "/admin/contracts-kys" },
    { label: "KPI submissions", value: data?.kpiSubmissions, icon: LineChart, to: "/admin/kpi" },
    { label: "Monthly updates needing attention", value: data?.monthlyUpdatesNeedingAttention, icon: CalendarClock, to: "/admin/monthly-updates" },
    { label: "Data Room documents pending", value: data?.pendingDocuments, icon: FolderLock, to: "/admin/data-room" },
    { label: "Upcoming mentorship sessions", value: data?.upcomingMentorshipSessions, icon: UsersRound, to: "/admin/mentorship" },
    { label: "Team members", value: data?.teamMembers, icon: Contact, to: "/admin/team" },
    { label: "Open Startup School trainings", value: data?.trainings, icon: GraduationCap, to: "/admin/school" },
  ];

  return (
    <AppShell>
      <main className="ost-page">
        <PageHeader eyebrow="Administration" title="Admin dashboard" subtitle="Overview of the whole platform." />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.label}
                onClick={() => navigate(c.to)}
                className="ost-card group p-6 text-left transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-secondary" />
                </div>
                <div className="mt-4 text-3xl font-extrabold text-primary">
                  {isLoading ? "—" : c.value ?? 0}
                </div>
                <div className="text-sm text-slate-500">{c.label}</div>
              </button>
            );
          })}
        </div>

        {!isLoading && (data?.pendingDeletions ?? 0) > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-sm font-medium text-amber-700">
              {data!.pendingDeletions} startup deletion request
              {data!.pendingDeletions > 1 ? "s" : ""} awaiting your review.
            </span>
            <button onClick={() => navigate("/admin/deletion-requests")} className="ost-btn-primary">
              Review now
            </button>
          </div>
        )}

        {!isLoading && pendingReviews > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-sm font-medium text-amber-700">
              {pendingReviews} contract/KYS submission{pendingReviews > 1 ? "s" : ""} awaiting your review.
            </span>
            <button onClick={() => navigate("/admin/contracts-kys")} className="ost-btn-primary">
              Review now
            </button>
          </div>
        )}

        {!isLoading && (data?.monthlyUpdatesNeedingAttention ?? 0) > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-sm font-medium text-amber-700">
              {data!.monthlyUpdatesNeedingAttention} monthly update{data!.monthlyUpdatesNeedingAttention > 1 ? "s" : ""} flagged at-risk, off-track, or requesting support.
            </span>
            <button onClick={() => navigate("/admin/monthly-updates")} className="ost-btn-primary">
              Review now
            </button>
          </div>
        )}

        {!isLoading && (data?.pendingDocuments ?? 0) > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-sm font-medium text-amber-700">
              {data!.pendingDocuments} Data Room document{data!.pendingDocuments > 1 ? "s" : ""} awaiting your review.
            </span>
            <button onClick={() => navigate("/admin/data-room")} className="ost-btn-primary">
              Review now
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
