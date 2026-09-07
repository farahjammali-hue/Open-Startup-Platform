import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { ReviewActions, EventHistory, Detail, TRACK_LABEL, IRS_LABEL, DOC_LABEL, type EventRow } from "../../components/admin/reviewHelpers";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS, type ReviewStatus } from "../../lib/statusTones";
import { showToast } from "../../lib/toast";
import { Building2, FileSignature, ShieldCheck, ExternalLink } from "lucide-react";

interface StartupBasic { id: string; companyName: string }

interface ContractRow {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  status: ReviewStatus;
  reviewNote: string | null;
}

interface KysRow {
  id: string;
  track: "pre_seed" | "seed";
  incorporated: boolean;
  submittedAt: string;
  status: ReviewStatus;
  reviewNote: string | null;
  addressLine1: string | null; city: string | null; country: string | null; incorporationDate: string | null;
  tin: string | null; signatoryName: string | null; signatoryPhone: string | null; signatoryEmail: string | null;
  irsForm: string | null; acceptsAltPayment: boolean | null; altPaymentDetail: string | null;
  repName: string | null; repPhone: string | null; repEmail: string | null; disclaimerAccepted: boolean | null;
  consentAccepted: boolean;
}

interface KysDoc { id: string; docType: string; fileUrl: string; fileName: string }

export default function AdminContractsKysStartup() {
  const [, params] = useRoute("/admin/contracts-kys/:startupId");
  const startupId = params?.startupId ?? "";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ startup: StartupBasic; contract: ContractRow | null; kysProfile: KysRow | null }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/contracts-kys" label="Back to Contracts & KYS" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup, contract, kysProfile } = data;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] });
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/contracts-kys" label="Back to Contracts & KYS" />
        <PageHeader
          eyebrow="Administration · Contracts & KYS"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Review this startup's signed agreement and KYS submission."
        />

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title mb-4 flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4 text-secondary" /> Contract
          </h2>
          {contract ? <ContractReview contract={contract} onReviewed={invalidate} /> : (
            <EmptyState icon={FileSignature} title="Not signed yet" description="This startup hasn't uploaded a signed agreement." />
          )}
        </div>

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title mb-4 flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-secondary" /> KYS profile
          </h2>
          {kysProfile ? <KysReview kys={kysProfile} onReviewed={invalidate} /> : (
            <EmptyState icon={ShieldCheck} title="Not submitted yet" description="This startup hasn't submitted their KYS profile." />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function ContractReview({ contract, onReviewed }: { contract: ContractRow; onReviewed: () => void }) {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const { data } = useQuery<{ events: EventRow[] }>({
    queryKey: ["admin-contract-events", contract.id],
    queryFn: () => api(`/api/admin/contracts/${contract.id}/events`),
  });

  async function handleReview(status: "approved" | "rejected", note: string) {
    setReviewing(true);
    try {
      await api(`/api/admin/contracts/${contract.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNote: note }),
      });
      qc.invalidateQueries({ queryKey: ["admin-contract-events", contract.id] });
      onReviewed();
    } catch (e: any) {
      showToast(e.message || "Couldn't save this review");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div>
          <div className="text-sm font-semibold text-primary">{contract.fileName || "No file uploaded"}</div>
          {contract.uploadedAt && (
            <div className="text-xs text-slate-400">uploaded {new Date(contract.uploadedAt).toLocaleString()}</div>
          )}
        </div>
        <StatusBadge tone={REVIEW_STATUS_TONES[contract.status]} icon={REVIEW_STATUS_ICONS[contract.status]}>{contract.status}</StatusBadge>
      </div>

      {contract.fileUrl && (
        <a href={contract.fileUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost mb-4 inline-flex !px-3 !py-1.5 text-xs">
          <ExternalLink className="h-3.5 w-3.5" /> View PDF
        </a>
      )}

      {contract.reviewNote && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Last note: “{contract.reviewNote}”</p>
      )}

      <ReviewActions status={contract.status} onReview={handleReview} reviewing={reviewing} />
      <EventHistory events={data?.events ?? []} />
    </>
  );
}

function KysReview({ kys, onReviewed }: { kys: KysRow; onReviewed: () => void }) {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const { data, isLoading } = useQuery<{ profile: KysRow; documents: KysDoc[] }>({
    queryKey: ["admin-kys-detail", kys.id],
    queryFn: () => api(`/api/admin/kys/${kys.id}`),
  });
  const { data: eventsData } = useQuery<{ events: EventRow[] }>({
    queryKey: ["admin-kys-events", kys.id],
    queryFn: () => api(`/api/admin/kys/${kys.id}/events`),
  });

  async function handleReview(status: "approved" | "rejected", note: string) {
    setReviewing(true);
    try {
      await api(`/api/admin/kys/${kys.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNote: note }),
      });
      qc.invalidateQueries({ queryKey: ["admin-kys-detail", kys.id] });
      qc.invalidateQueries({ queryKey: ["admin-kys-events", kys.id] });
      onReviewed();
    } catch (e: any) {
      showToast(e.message || "Couldn't save this review");
    } finally {
      setReviewing(false);
    }
  }

  const profile = data?.profile;
  const documents = data?.documents ?? [];

  if (isLoading || !profile) return <SkeletonText lines={6} />;

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div className="text-sm text-slate-500">
          {TRACK_LABEL[profile.track] || profile.track} track · {profile.incorporated ? "Incorporated" : "Not incorporated"} · submitted {new Date(profile.submittedAt).toLocaleString()}
        </div>
        <StatusBadge tone={REVIEW_STATUS_TONES[profile.status]} icon={REVIEW_STATUS_ICONS[profile.status]}>{profile.status}</StatusBadge>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {profile.incorporated ? (
          <>
            <Detail label="Address" value={[profile.addressLine1, profile.city, profile.country].filter(Boolean).join(", ")} />
            <Detail label="Date of incorporation" value={profile.incorporationDate} />
            <Detail label="TIN / VAT / EIN" value={profile.tin} />
            <Detail label="IRS form" value={profile.irsForm ? IRS_LABEL[profile.irsForm] || profile.irsForm : null} />
            <Detail label="Signatory" value={profile.signatoryName} />
            <Detail label="Signatory contact" value={[profile.signatoryPhone, profile.signatoryEmail].filter(Boolean).join(" · ")} />
            {profile.acceptsAltPayment != null && <Detail label="Accepts alt. payment" value={profile.acceptsAltPayment ? (profile.altPaymentDetail || "Yes") : "No"} />}
          </>
        ) : (
          <>
            <Detail label="Representative" value={profile.repName} />
            <Detail label="Representative contact" value={[profile.repPhone, profile.repEmail].filter(Boolean).join(" · ")} />
            <Detail label="Fellowship funds disclaimer" value={profile.disclaimerAccepted ? "Accepted" : "Not accepted"} />
          </>
        )}
        <Detail label="Data-handling consent" value={profile.consentAccepted ? "Accepted" : "Not accepted"} />
      </div>

      <div className="mb-4">
        <div className="ost-label">Documents</div>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-400">No documents uploaded.</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((d) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary hover:border-secondary"
              >
                <span>{DOC_LABEL[d.docType] || d.docType}<span className="ml-2 text-xs text-slate-400">{d.fileName}</span></span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>
            ))}
          </div>
        )}
      </div>

      {profile.reviewNote && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Last note: “{profile.reviewNote}”</p>
      )}

      <ReviewActions status={profile.status} onReview={handleReview} reviewing={reviewing} />
      <EventHistory events={eventsData?.events ?? []} />
    </>
  );
}
