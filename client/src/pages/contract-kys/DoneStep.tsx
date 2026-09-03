import { StatusBadge } from "../../components/StatusBadge";
import type { Contract, KysProfile, ReviewStatus } from "../../lib/kysStatus";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS } from "../../lib/statusTones";
import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: "Pending review", approved: "Approved", rejected: "Changes requested" };

export function DoneStep({
  contract,
  kysProfile,
  onGoToDashboard,
  onEditContract,
  onEditKys,
}: {
  contract: Contract | null;
  kysProfile: KysProfile | null;
  onGoToDashboard: () => void;
  onEditContract: () => void;
  onEditKys: () => void;
}) {
  const anyRejected = contract?.status === "rejected" || kysProfile?.status === "rejected";

  return (
    <div className="ost-card flex flex-col items-center gap-4 px-8 py-16 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl ${anyRejected ? "bg-red-50 text-red-500" : "bg-[rgba(92,212,94,0.16)] text-[#256b28]"}`}>
        {anyRejected ? <XCircle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="ost-card-title text-xl">{anyRejected ? "Changes requested" : "Contract & KYS submitted"}</h2>
        <p className="ost-card-subtext">
          {anyRejected
            ? "The OST team asked for a change before this can be approved. See the notes below."
            : "Your onboarding requirements have been submitted and are awaiting review."}
        </p>
      </div>

      <div className="my-2 flex w-full max-w-md flex-col gap-3 text-left">
        <StatusRow
          label="Contract"
          status={contract?.status ?? "pending"}
          note={contract?.reviewNote ?? null}
          onEdit={onEditContract}
          downloadUrl={contract?.fileUrl ?? undefined}
        />
        <StatusRow
          label="Know Your Startup (KYS)"
          status={kysProfile?.status ?? "pending"}
          note={kysProfile?.reviewNote ?? null}
          onEdit={onEditKys}
        />
      </div>

      <button onClick={onGoToDashboard} className="ost-btn-primary">
        Go to Dashboard <FileText className="hidden" />
      </button>
    </div>
  );
}

function StatusRow({
  label,
  status,
  note,
  onEdit,
  downloadUrl,
}: {
  label: string;
  status: ReviewStatus;
  note: string | null;
  onEdit: () => void;
  downloadUrl?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-primary">{label}</span>
        <StatusBadge tone={REVIEW_STATUS_TONES[status]} icon={REVIEW_STATUS_ICONS[status]}>{STATUS_LABEL[status]}</StatusBadge>
      </div>
      {note && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{note}”</p>
      )}
      {status === "rejected" && (
        <button onClick={onEdit} className="ost-btn-ghost mt-3 !px-3 !py-1.5 text-xs">
          Update &amp; resubmit
        </button>
      )}
      {downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost mt-3 inline-flex !px-3 !py-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> View signed contract
        </a>
      )}
    </div>
  );
}
