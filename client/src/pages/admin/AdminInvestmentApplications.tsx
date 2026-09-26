import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonText } from "../../components/Skeleton";
import { showToast } from "../../lib/toast";
import { Bank, CaretDown, CaretUp, CheckCircle, XCircle, Hourglass, ArrowSquareOut as ExternalLink, CircleNotch as Loader2 } from "@phosphor-icons/react";

// PHASE D5: the admin side of investment applications — a queue in the same
// spirit as Signup Approvals, but repeatable per startup and with the frozen
// snapshot alongside the live data links.

/** A canonically resolved figure frozen at submit time (Phase 3a). */
interface SnapshotFact {
  value: number | string | null;
  source: string | null;
  asOf: string | null;
}

const factTitle = (f: SnapshotFact) => (f.source ? `From ${f.source}${f.asOf ? ` (${f.asOf})` : ""}` : undefined);

interface AppRow {
  id: string;
  startupId: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  status: "submitted" | "under_review" | "accepted" | "rejected";
  answers: Record<string, string>;
  snapshot: {
    headline?: Record<string, unknown>;
    canonical?: Partial<Record<"teamSize" | "valuation" | "totalRaised" | "grants" | "cumulativeRevenue" | "mrr", SnapshotFact>>;
    readiness?: { missing: string[] };
    at?: string;
  };
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

const ANSWER_LABELS: Record<string, string> = {
  amountSought: "Amount sought",
  roundType: "Round type",
  useOfFunds: "Use of funds",
  tractionNarrative: "Where the business stands",
  timeline: "Timeline",
};

const STATUS_META: Record<AppRow["status"], { label: string; className: string; icon: any }> = {
  submitted: { label: "New", className: "bg-amber-50 text-amber-700", icon: Hourglass },
  under_review: { label: "Under review", className: "bg-amber-50 text-amber-700", icon: Hourglass },
  accepted: { label: "Accepted", className: "bg-[rgba(92,212,94,0.16)] text-[#256b28]", icon: CheckCircle },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-600", icon: XCircle },
};

export default function AdminInvestmentApplications() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ applications: AppRow[] }>({
    queryKey: ["admin-investment-apps"],
    queryFn: () => api("/api/admin/investment-applications"),
  });
  const rows = data?.applications ?? [];
  const open = rows.filter((r) => r.status === "submitted" || r.status === "under_review");
  const decided = rows.filter((r) => r.status === "accepted" || r.status === "rejected");

  async function decide(row: AppRow, status: "under_review" | "accepted" | "rejected") {
    const note = (notes[row.id] ?? "").trim();
    if ((status === "accepted" || status === "rejected") && !confirm(`${status === "accepted" ? "Accept" : "Reject"} ${row.companyName}'s application? The founder is emailed the decision${note ? " and your note" : ""}.`)) return;
    setBusyId(row.id);
    try {
      await api(`/api/admin/investment-applications/${row.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ status, note }),
      });
      showToast(status === "under_review" ? "Marked under review." : `Application ${status}.`);
      qc.invalidateQueries({ queryKey: ["admin-investment-apps"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't save the decision");
    } finally {
      setBusyId(null);
    }
  }

  function Card({ row }: { row: AppRow }) {
    const opened = openId === row.id;
    const meta = STATUS_META[row.status];
    const Icon = meta.icon;
    const headline = row.snapshot?.headline ?? {};
    const canonical = row.snapshot?.canonical;
    return (
      <div className="ost-card p-5">
        <button onClick={() => setOpenId(opened ? null : row.id)} className="flex w-full items-start justify-between gap-3 text-left">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-primary">{row.companyName}</span>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              Seeking <span className="font-semibold text-primary">{row.answers?.amountSought ?? "—"}</span>
              {row.answers?.roundType ? ` · ${row.answers.roundType}` : ""}
              {row.submittedAt ? ` · submitted ${new Date(row.submittedAt).toLocaleDateString()}` : ""}
            </div>
            <div className="text-xs text-slate-400">{row.ownerName} · {row.ownerEmail}</div>
          </div>
          {opened ? <CaretUp className="mt-1 h-4 w-4 shrink-0 text-slate-400" /> : <CaretDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
        </button>

        {opened && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(ANSWER_LABELS).map(([key, label]) =>
                row.answers?.[key] ? (
                  <div key={key} className={key === "useOfFunds" || key === "tractionNarrative" ? "sm:col-span-2" : ""}>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{row.answers[key]}</div>
                  </div>
                ) : null,
              )}
            </div>

            {Object.keys(headline).length > 0 && (
              <div className="rounded-lg bg-[var(--bg-subtle)] p-4 text-sm text-slate-600">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Snapshot at submission</div>
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
                  {"stage" in headline && headline.stage != null && <span>Stage: {String(headline.stage)}</span>}
                  {"revenueLast12Months" in headline && headline.revenueLast12Months != null && <span>Revenue (12m): ${Number(headline.revenueLast12Months).toLocaleString()}</span>}
                  {"totalFundingRaised" in headline && headline.totalFundingRaised != null && <span>Raised to date: ${Number(headline.totalFundingRaised).toLocaleString()}</span>}
                  {"lastValuation" in headline && headline.lastValuation != null && <span>Last valuation: ${Number(headline.lastValuation).toLocaleString()}</span>}
                  {canonical?.teamSize?.value != null && <span title={factTitle(canonical.teamSize)}>Team size: {Number(canonical.teamSize.value).toLocaleString()}</span>}
                  {canonical?.mrr?.value != null && <span title={factTitle(canonical.mrr)}>MRR: ${Number(canonical.mrr.value).toLocaleString()}</span>}
                  {canonical?.cumulativeRevenue?.value != null && <span title={factTitle(canonical.cumulativeRevenue)}>Cumulative revenue: ${Number(canonical.cumulativeRevenue.value).toLocaleString()}</span>}
                  {canonical?.grants?.value != null && <span title={factTitle(canonical.grants)}>Grants: ${Number(canonical.grants.value).toLocaleString()}</span>}
                </div>
              </div>
            )}

            <button onClick={() => navigate(`/admin/startups/${row.startupId}`)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
              <ExternalLink className="h-4 w-4" /> Open {row.companyName}'s live data
            </button>

            {(row.status === "submitted" || row.status === "under_review") && (
              <div>
                <label htmlFor={`note-${row.id}`} className="ost-label">Note to the founder (optional, sent with the decision)</label>
                <textarea
                  id={`note-${row.id}`}
                  className="ost-input min-h-[60px]"
                  value={notes[row.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  maxLength={2000}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === "submitted" && (
                    <button onClick={() => decide(row, "under_review")} disabled={busyId === row.id} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                      Mark under review
                    </button>
                  )}
                  <button onClick={() => decide(row, "accepted")} disabled={busyId === row.id} className="ost-btn-primary !px-4 !py-1.5 text-xs">
                    {busyId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Accept
                  </button>
                  <button onClick={() => decide(row, "rejected")} disabled={busyId === row.id} className="rounded-lg border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                    Reject
                  </button>
                </div>
              </div>
            )}
            {row.decisionNote && row.status !== "submitted" && row.status !== "under_review" && (
              <p className="text-sm text-slate-500">Decision note: {row.decisionNote}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Investment applications"
          subtitle="Alumni startups applying to the investment plan — their live dashboard and data room back each application."
        />

        <div className="mt-8 max-w-3xl space-y-4">
          {isLoading ? (
            <div className="ost-card p-6"><SkeletonText lines={4} /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Bank} title="No applications yet" description="When an alumni startup applies, it lands here for review." />
          ) : (
            <>
              {open.map((r) => <Card key={r.id} row={r} />)}
              {decided.length > 0 && (
                <>
                  <h2 className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Decided</h2>
                  {decided.map((r) => <Card key={r.id} row={r} />)}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
