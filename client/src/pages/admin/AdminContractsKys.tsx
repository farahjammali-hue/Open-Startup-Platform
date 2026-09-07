import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonRows } from "../../components/Skeleton";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS, type ReviewStatus } from "../../lib/statusTones";
import { Building2 } from "lucide-react";

interface StartupRow {
  id: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  contractStatus: ReviewStatus | null;
  kysStatus: ReviewStatus | null;
}

function StatusCell({ status, missingLabel }: { status: ReviewStatus | null; missingLabel: string }) {
  if (!status) return <span className="text-xs text-slate-400">{missingLabel}</span>;
  const Icon = REVIEW_STATUS_ICONS[status];
  return <StatusBadge tone={REVIEW_STATUS_TONES[status]} icon={Icon}>{status}</StatusBadge>;
}

export default function AdminContractsKys() {
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
          title="Contracts & KYS"
          subtitle="Pick a startup to review their signed agreement and KYS submission."
        />

        <div className="ost-card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Startup</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Contract</th>
                  <th className="px-5 py-3 font-semibold">KYS</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows rows={5} cols={4} />
                ) : startups.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-slate-400">No startups yet.</td></tr>
                ) : (
                  startups.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/contracts-kys/${s.id}`)}
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
                      <td className="px-5 py-3"><StatusCell status={s.contractStatus} missingLabel="Not signed" /></td>
                      <td className="px-5 py-3"><StatusCell status={s.kysStatus} missingLabel="Not submitted" /></td>
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
