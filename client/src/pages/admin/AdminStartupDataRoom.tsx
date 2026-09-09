import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { Building2, ExternalLink, FolderLock } from "lucide-react";

interface StartupBasic {
  companyName: string;
  dataRoomLink: string | null;
  dataRoomUpdatedAt: string | null;
}

export default function AdminStartupDataRoom() {
  const [, params] = useRoute("/admin/startups/:id/data-room");
  const id = params?.id ?? "";

  const { data, isLoading } = useQuery<{ startup: StartupBasic }>({
    queryKey: ["admin-startup-detail", id],
    queryFn: () => api(`/api/admin/startups/${id}`),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup } = data;

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
        <PageHeader
          eyebrow="Administration · Data Room"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Wherever this startup's own data room already lives."
        />

        <div className="ost-card mt-8 p-6">
          {startup.dataRoomLink ? (
            <>
              <a href={startup.dataRoomLink} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 hover:border-secondary">
                <span className="truncate text-sm font-semibold text-primary">{startup.dataRoomLink}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
              <p className="mt-2 text-xs text-slate-400">
                {startup.dataRoomUpdatedAt
                  ? `Startup marked this updated on ${new Date(startup.dataRoomUpdatedAt).toLocaleString()}`
                  : "The startup hasn't marked this as updated since submitting the link."}
              </p>
            </>
          ) : (
            <EmptyState icon={FolderLock} title="No data room link yet" description="This startup hasn't submitted a data room link." />
          )}
        </div>
      </main>
    </AppShell>
  );
}
