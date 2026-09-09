import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { SkeletonRows } from "../../components/Skeleton";
import { Building2 } from "lucide-react";

interface StartupRow {
  id: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  mentorName: string | null;
}

export default function AdminMentorship() {
  const [, navigate] = useLocation();

  const { data: startupsData, isLoading: startupsLoading } = useQuery<{ startups: StartupRow[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const startups = startupsData?.startups ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Mentorship"
          subtitle="Pick a startup to manage their mentor, sessions, and the shared experts catalog."
        />

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Startups</h2>
        </div>

        <div className="ost-card mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Startup</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Mentor</th>
                </tr>
              </thead>
              <tbody>
                {startupsLoading ? (
                  <SkeletonRows rows={4} cols={3} />
                ) : startups.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-6 text-slate-400">No startups yet.</td></tr>
                ) : (
                  startups.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/mentorship/${s.id}`)}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-secondary" />
                          <span className="font-semibold text-primary">{s.companyName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        <div>{s.ownerName}</div>
                        <div className="text-xs text-slate-400">{s.ownerEmail}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{s.mentorName || "—"}</td>
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
