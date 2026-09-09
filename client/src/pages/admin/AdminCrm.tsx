import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
}

export default function AdminCrm() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ startups: StartupRow[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const startups = data?.startups ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="CRM"
          subtitle="Pick a startup to manage their investors, clients, and partners."
        />

        <div className="ost-card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Startup</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows rows={4} cols={2} />
                ) : startups.length === 0 ? (
                  <tr><td colSpan={2} className="px-5 py-6 text-slate-400">No startups yet.</td></tr>
                ) : (
                  startups.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/crm/${s.id}`)}
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
