import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton } from "../../components/Skeleton";
import { FolderLock, Building2, ExternalLink } from "lucide-react";

interface StartupRow {
  id: string;
  companyName: string;
  dataRoomLink: string | null;
  dataRoomUpdatedAt: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

export default function AdminDataRoom() {
  const { data, isLoading } = useQuery<{ startups: StartupRow[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });

  const rows = data?.startups ?? [];
  const submittedCount = rows.filter((s) => s.dataRoomLink).length;

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Data Room"
          subtitle={`Data room links submitted by each startup · ${submittedCount} of ${rows.length} submitted`}
        />

        <div className="ost-card mt-8 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={FolderLock} title="No startups yet" description="Startups will show up here once they've signed up." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Startup</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Data room link</th>
                    <th className="px-5 py-3 font-semibold">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-secondary" />
                          <div>
                            <div className="font-semibold text-primary">{s.companyName}</div>
                            <div className="text-xs text-slate-400">{s.ownerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={s.dataRoomLink ? "teal" : "gray"}>{s.dataRoomLink ? "Submitted" : "Not submitted"}</StatusBadge>
                      </td>
                      <td className="px-5 py-3">
                        {s.dataRoomLink ? (
                          <a href={s.dataRoomLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-secondary hover:underline">
                            <span className="max-w-xs truncate">{s.dataRoomLink}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {s.dataRoomUpdatedAt ? new Date(s.dataRoomUpdatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
