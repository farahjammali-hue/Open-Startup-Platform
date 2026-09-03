import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { TONE_CLASSES, type StatusTone } from "../../components/StatusBadge";
import { Users, Building2 } from "lucide-react";

type MemberType = "founder" | "full_time" | "part_time" | "advisor";
interface Member {
  id: string; startupId: string; name: string; role: string | null;
  type: MemberType; joinedAt: string; companyName: string;
}

const TYPE_LABELS: Record<MemberType, string> = {
  founder: "Founder", full_time: "Full-time", part_time: "Part-time", advisor: "Advisor",
};
const TYPE_TONES: Record<MemberType, StatusTone> = {
  founder: "primary", full_time: "teal", part_time: "amber", advisor: "gray",
};

export default function AdminTeam() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<{ members: Member[] }>({
    queryKey: ["admin-team"],
    queryFn: () => api("/api/admin/team"),
  });

  const members = data?.members ?? [];
  const byStartup = new Map<string, { companyName: string; members: Member[] }>();
  for (const m of members) {
    if (!byStartup.has(m.startupId)) byStartup.set(m.startupId, { companyName: m.companyName, members: [] });
    byStartup.get(m.startupId)!.members.push(m);
  }
  const groups = [...byStartup.entries()].sort((a, b) => a[1].companyName.localeCompare(b[1].companyName));

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Team rosters"
          subtitle={`${members.length} team member${members.length === 1 ? "" : "s"} across ${groups.length} startup${groups.length === 1 ? "" : "s"}.`}
        />

        <div className="mt-8 space-y-6">
          {isLoading ? (
            <SkeletonCards count={3} />
          ) : groups.length === 0 ? (
            <EmptyState icon={Users} title="No team members yet" description="Team rosters added by startups will show up here." />
          ) : (
            groups.map(([startupId, g]) => (
              <div key={startupId} className="ost-card p-6">
                <button
                  onClick={() => navigate(`/admin/startups/${startupId}`)}
                  className="mb-4 flex items-center gap-2 text-left"
                >
                  <Building2 className="h-4 w-4 text-secondary" />
                  <span className="ost-card-title text-base hover:text-secondary">{g.companyName}</span>
                  <span className="text-xs font-medium text-slate-400">{g.members.length} member{g.members.length === 1 ? "" : "s"}</span>
                </button>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.members.map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-100 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">{m.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[TYPE_TONES[m.type]]}`}>
                          {TYPE_LABELS[m.type]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {m.role || "—"} · Joined {new Date(m.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </AppShell>
  );
}
