import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Users, Rocket, Trash2, ArrowRight, FileSignature, LineChart, UsersRound, Presentation, FileText } from "lucide-react";

interface Stats {
  users: number; startups: number; pendingDeletions: number;
  pendingContracts: number; pendingKys: number; startupsMissingMetrics: number;
  upcomingMentorshipSessions: number;
  upcomingTrainingSessions: number; schoolDocs: number;
}

interface CardDef {
  label: string;
  value: number | undefined;
  icon: any;
  to: string;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => api("/api/admin/stats"),
  });

  const pendingReviews = (data?.pendingContracts ?? 0) + (data?.pendingKys ?? 0);

  const needsAttention: CardDef[] = [
    { label: "Pending deletions", value: data?.pendingDeletions, icon: Trash2, to: "/admin/deletion-requests" },
    { label: "Contracts & KYS to review", value: pendingReviews, icon: FileSignature, to: "/admin/contracts-kys" },
    { label: "Startups missing this month's update", value: data?.startupsMissingMetrics, icon: LineChart, to: "/admin/startups" },
  ];

  const platform: CardDef[] = [
    { label: "Users", value: data?.users, icon: Users, to: "/admin/users" },
    { label: "Startups", value: data?.startups, icon: Rocket, to: "/admin/startups" },
  ];

  const program: CardDef[] = [
    { label: "Upcoming mentorship sessions", value: data?.upcomingMentorshipSessions, icon: UsersRound, to: "/admin/mentorship" },
    { label: "Upcoming training sessions", value: data?.upcomingTrainingSessions, icon: Presentation, to: "/admin/training" },
    { label: "Open Startup School Docs", value: data?.schoolDocs, icon: FileText, to: "/admin/school" },
  ];

  return (
    <AppShell>
      <main className="ost-page">
        <PageHeader eyebrow="Administration" title="Admin dashboard" subtitle="Overview of the whole platform." />

        <CardSection label="Needs your attention" cards={needsAttention} isLoading={isLoading} onNavigate={navigate} tone="warning" />
        <CardSection label="Platform" cards={platform} isLoading={isLoading} onNavigate={navigate} tone="neutral" />
        <CardSection label="Program" cards={program} isLoading={isLoading} onNavigate={navigate} tone="neutral" />
      </main>
    </AppShell>
  );
}

function CardSection({
  label,
  cards,
  isLoading,
  onNavigate,
  tone,
}: {
  label: string;
  cards: CardDef[];
  isLoading: boolean;
  onNavigate: (to: string) => void;
  tone: "warning" | "neutral";
}) {
  return (
    <div className="mt-8 first:mt-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const isWarning = tone === "warning";
          return (
            <button
              key={c.label}
              onClick={() => onNavigate(c.to)}
              className={`group p-6 text-left transition hover:-translate-y-0.5 hover:shadow-card-hover ${
                isWarning ? "rounded-2xl border border-amber-200 bg-amber-50" : "ost-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    isWarning ? "bg-white text-amber-600" : "bg-secondary/10 text-secondary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className={`h-4 w-4 ${isWarning ? "text-amber-300 group-hover:text-amber-600" : "text-slate-300 group-hover:text-secondary"}`} />
              </div>
              <div className={`mt-4 text-3xl font-extrabold ${isWarning ? "text-amber-700" : "text-primary"}`}>
                {isLoading ? "—" : c.value ?? 0}
              </div>
              <div className={`text-sm ${isWarning ? "text-amber-700" : "text-slate-500"}`}>{c.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
