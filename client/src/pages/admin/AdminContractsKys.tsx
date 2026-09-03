import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { showToast } from "../../lib/toast";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS, type ReviewStatus } from "../../lib/statusTones";
import {
  FileSignature, ShieldCheck, CheckCircle2, XCircle, Loader2, ExternalLink, History, Building2,
} from "lucide-react";

interface ContractRow {
  id: string; startupId: string; fileUrl: string | null; fileName: string | null;
  uploadedAt: string | null;
  status: ReviewStatus; reviewNote: string | null; reviewedAt: string | null;
  companyName: string | null; ownerName: string | null; ownerEmail: string | null;
}

interface KysRow {
  id: string; startupId: string; track: "pre_seed" | "seed"; incorporated: boolean;
  submittedAt: string; status: ReviewStatus; reviewNote: string | null; reviewedAt: string | null;
  companyName: string | null; ownerName: string | null; ownerEmail: string | null;
}

interface KysProfileDetail extends KysRow {
  addressLine1: string | null; city: string | null; country: string | null; incorporationDate: string | null;
  tin: string | null; signatoryName: string | null; signatoryPhone: string | null; signatoryEmail: string | null;
  irsForm: string | null; acceptsAltPayment: boolean | null; altPaymentDetail: string | null;
  repName: string | null; repPhone: string | null; repEmail: string | null; disclaimerAccepted: boolean | null;
  consentAccepted: boolean;
}

interface KysDoc { id: string; docType: string; fileUrl: string; fileName: string }
interface EventRow { id: string; action: string; note: string | null; createdAt: string }

const TRACK_LABEL: Record<string, string> = { pre_seed: "Pre-Seed", seed: "Seed" };
const IRS_LABEL: Record<string, string> = { w9: "W-9", w8ben: "W-8BEN", w8bene: "W-8BEN-E" };
const DOC_LABEL: Record<string, string> = {
  certificate_of_incorporation: "Certificate of Incorporation",
  proof_of_address: "Proof of address",
  irs_form: "IRS form",
  banking: "Banking",
  declaration: "Declaration",
  identity_document: "Identity document",
};

const TABS = [
  { key: "contracts", label: "Contracts" },
  { key: "kys", label: "KYS" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function AdminContractsKys() {
  const [tab, setTab] = useState<Tab>("contracts");
  const [openContract, setOpenContract] = useState<ContractRow | null>(null);
  const [openKysRow, setOpenKysRow] = useState<KysRow | null>(null);

  const { data: contractsData, isLoading: loadingContracts } = useQuery<{ contracts: ContractRow[] }>({
    queryKey: ["admin-contracts"],
    queryFn: () => api("/api/admin/contracts"),
  });
  const { data: kysData, isLoading: loadingKys } = useQuery<{ profiles: KysRow[] }>({
    queryKey: ["admin-kys"],
    queryFn: () => api("/api/admin/kys"),
  });

  const contracts = contractsData?.contracts ?? [];
  const profiles = kysData?.profiles ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Contracts & KYS"
          subtitle="Review signed program agreements and KYS submissions."
        />

        <TabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "contracts" && (
          <div className="ost-card overflow-hidden">
            {loadingContracts ? (
              <TableSkeleton />
            ) : contracts.length === 0 ? (
              <EmptyState icon={FileSignature} title="No contracts uploaded yet" description="Signed program agreements will show up here for your review." />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Startup</th>
                    <th className="px-5 py-3 font-semibold">File</th>
                    <th className="px-5 py-3 font-semibold">Uploaded</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-secondary" />
                          <div>
                            <div className="font-semibold text-primary">{c.companyName || "—"}</div>
                            <div className="text-xs text-slate-400">{c.ownerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{c.fileName || "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={REVIEW_STATUS_TONES[c.status]} icon={REVIEW_STATUS_ICONS[c.status]}>{c.status}</StatusBadge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setOpenContract(c)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === "kys" && (
          <div className="ost-card overflow-hidden">
            {loadingKys ? (
              <TableSkeleton />
            ) : profiles.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No KYS submissions yet" description="Submitted KYS profiles will show up here for your review." />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Startup</th>
                    <th className="px-5 py-3 font-semibold">Track</th>
                    <th className="px-5 py-3 font-semibold">Incorporated</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-secondary" />
                          <div>
                            <div className="font-semibold text-primary">{p.companyName || "—"}</div>
                            <div className="text-xs text-slate-400">{p.ownerEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{TRACK_LABEL[p.track] || p.track}</td>
                      <td className="px-5 py-3 text-slate-500">{p.incorporated ? "Yes" : "No"}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(p.submittedAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={REVIEW_STATUS_TONES[p.status]} icon={REVIEW_STATUS_ICONS[p.status]}>{p.status}</StatusBadge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setOpenKysRow(p)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </main>

      {openContract && <ContractReviewModal contract={openContract} onClose={() => setOpenContract(null)} />}
      {openKysRow && <KysReviewModal row={openKysRow} onClose={() => setOpenKysRow(null)} />}
    </AppShell>
  );
}

/* ---------------- Shared review controls ---------------- */
function ReviewActions({
  status,
  onReview,
  reviewing,
}: {
  status: ReviewStatus;
  onReview: (status: "approved" | "rejected", note: string) => Promise<void>;
  reviewing: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="ost-label">Review note (optional)</label>
      <textarea
        className="ost-input min-h-[70px]"
        placeholder="Add a note for the founder…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          disabled={reviewing}
          onClick={() => onReview("rejected", note)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Reject
        </button>
        <button
          disabled={reviewing}
          onClick={() => onReview("approved", note)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {status === "pending" ? "Approve" : "Re-approve"}
        </button>
      </div>
    </div>
  );
}

function EventHistory({ events }: { events: EventRow[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <History className="h-3.5 w-3.5" /> History
      </div>
      <div className="space-y-1.5">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-xs text-slate-500">
            <span><span className="capitalize">{e.action}</span>{e.note ? ` — “${e.note}”` : ""}</span>
            <span className="text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ---------------- Contract review ---------------- */
function ContractReviewModal({ contract, onClose }: { contract: ContractRow; onClose: () => void }) {
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
      qc.invalidateQueries({ queryKey: ["admin-contracts"] });
      qc.invalidateQueries({ queryKey: ["admin-contract-events", contract.id] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    } catch (e: any) {
      showToast(e.message || "Couldn't save this review");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <ModalShell title={contract.companyName || "Contract"} subtitle={contract.ownerEmail || undefined} onClose={onClose}>
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
    </ModalShell>
  );
}

/* ---------------- KYS review ---------------- */
function KysReviewModal({ row, onClose }: { row: KysRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const { data, isLoading } = useQuery<{ profile: KysProfileDetail; documents: KysDoc[] }>({
    queryKey: ["admin-kys-detail", row.id],
    queryFn: () => api(`/api/admin/kys/${row.id}`),
  });
  const { data: eventsData } = useQuery<{ events: EventRow[] }>({
    queryKey: ["admin-kys-events", row.id],
    queryFn: () => api(`/api/admin/kys/${row.id}/events`),
  });

  async function handleReview(status: "approved" | "rejected", note: string) {
    setReviewing(true);
    try {
      await api(`/api/admin/kys/${row.id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, reviewNote: note }),
      });
      qc.invalidateQueries({ queryKey: ["admin-kys"] });
      qc.invalidateQueries({ queryKey: ["admin-kys-detail", row.id] });
      qc.invalidateQueries({ queryKey: ["admin-kys-events", row.id] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    } catch (e: any) {
      showToast(e.message || "Couldn't save this review");
    } finally {
      setReviewing(false);
    }
  }

  const profile = data?.profile;
  const documents = data?.documents ?? [];

  return (
    <ModalShell title={row.companyName || "KYS submission"} subtitle={row.ownerEmail || undefined} onClose={onClose}>
      {isLoading || !profile ? (
        <SkeletonText lines={6} />
      ) : (
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
      )}
    </ModalShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm text-slate-600">{value}</div>
    </div>
  );
}
