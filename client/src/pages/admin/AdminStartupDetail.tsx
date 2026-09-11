import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { STAGE_LABELS, type StartupStage } from "../../lib/stageLabels";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS } from "../../lib/statusTones";
import {
  Building2, Globe, MapPin, LineChart, FolderLock,
  FileSignature, ShieldCheck, Layers, Handshake, ArrowRight,
} from "lucide-react";

interface ReviewEntity { status: "pending" | "approved" | "rejected"; reviewNote: string | null }

interface Detail {
  startup: {
    id: string; companyName: string; website: string | null; location: string | null;
    stage: string | null; logoUrl: string | null;
    dataRoomLink: string | null; mentorId: string | null;
  };
  owner: { name: string; email: string } | null;
  contract: (ReviewEntity & { signerName: string; signedAt: string }) | null;
  kysProfile: (ReviewEntity & { track: string; submittedAt: string }) | null;
}

export default function AdminStartupDetail() {
  const [, params] = useRoute("/admin/startups/:id");
  const id = params?.id ?? "";
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["admin-startup-detail", id],
    queryFn: () => api(`/api/admin/startups/${id}`),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/startups" label="Back to All startups" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton tone="dark" className="h-28 rounded-2xl" />
            <Skeleton tone="dark" className="h-28 rounded-2xl" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup, owner, contract, kysProfile } = data;

  const modules = [
    {
      key: "contracts-kys",
      title: "Contract & KYS",
      icon: FileSignature,
      to: `/admin/contracts-kys/${id}`,
      subtitle: `Contract ${contract?.status ?? "not started"} · KYS ${kysProfile?.status ?? "not started"}`,
    },
    {
      key: "data-room",
      title: "Data Room",
      icon: FolderLock,
      to: `/admin/startups/${id}/data-room`,
      subtitle: startup.dataRoomLink ? "Link on file" : "Not submitted yet",
    },
    {
      key: "dashboard",
      title: "Dashboard",
      icon: LineChart,
      to: `/admin/startups/${id}/dashboard`,
      subtitle: "Initial data, metrics & quarterly updates",
    },
    {
      key: "mentorship",
      title: "Mentorship",
      icon: Layers,
      to: `/admin/mentorship/${id}`,
      subtitle: startup.mentorId ? "Mentor assigned" : "No mentor assigned",
    },
    {
      key: "crm",
      title: "CRM",
      icon: Handshake,
      to: `/admin/crm/${id}`,
      subtitle: "Investors, clients & partners",
    },
  ];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/startups" label="Back to All startups" />
        <PageHeader
          eyebrow="Administration"
          title={
            <span className="flex items-center gap-3">
              {startup.logoUrl ? (
                <img src={startup.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <Building2 className="h-6 w-6 text-secondary" />
              )}
              {startup.companyName}
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-4 text-sm">
              {owner && <span>{owner.name} · {owner.email}</span>}
              {startup.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {startup.location}</span>}
              {startup.website && (
                <a href={startup.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-secondary hover:underline">
                  <Globe className="h-3.5 w-3.5" /> {startup.website}
                </a>
              )}
              {startup.stage && <span>{STAGE_LABELS[startup.stage as StartupStage] || startup.stage}</span>}
            </span>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge tone={contract ? REVIEW_STATUS_TONES[contract.status] : "gray"} icon={contract ? REVIEW_STATUS_ICONS[contract.status] : FileSignature}>
            Contract {contract ? contract.status : "not started"}
          </StatusBadge>
          <StatusBadge tone={kysProfile ? REVIEW_STATUS_TONES[kysProfile.status] : "gray"} icon={kysProfile ? REVIEW_STATUS_ICONS[kysProfile.status] : ShieldCheck}>
            KYS {kysProfile ? kysProfile.status : "not started"}
          </StatusBadge>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => navigate(m.to)}
                className="ost-card group p-6 text-left transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-secondary" />
                </div>
                <div className="mt-4 text-base font-bold text-primary">{m.title}</div>
                <div className="text-sm text-slate-500">{m.subtitle}</div>
              </button>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
