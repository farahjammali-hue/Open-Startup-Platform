import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import type { ReviewStatus } from "../../lib/statusTones";

export interface EventRow { id: string; action: string; note: string | null; createdAt: string }

export const TRACK_LABEL: Record<string, string> = { pre_seed: "Pre-Seed", seed: "Seed" };
export const IRS_LABEL: Record<string, string> = { w9: "W-9", w8ben: "W-8BEN", w8bene: "W-8BEN-E" };
export const DOC_LABEL: Record<string, string> = {
  certificate_of_incorporation: "Certificate of Incorporation",
  proof_of_address: "Proof of address",
  irs_form: "IRS form",
  banking: "Banking",
  declaration: "Declaration",
  identity_document: "Identity document",
};

export function ReviewActions({
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

export function EventHistory({ events }: { events: EventRow[] }) {
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

export function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm text-slate-600">{value}</div>
    </div>
  );
}
