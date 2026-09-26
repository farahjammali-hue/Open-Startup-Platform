import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader } from "../components/PageHeader";
import { SkeletonText } from "../components/Skeleton";
import { showToast } from "../lib/toast";
import { CheckCircle, Circle, CircleNotch as Loader2, PaperPlaneTilt as Send, Bank, Clock, XCircle } from "@phosphor-icons/react";

// PHASE D5: the alumni investment application. The checklist and the server
// enforce the same readiness rules (shared/applicationReadiness.ts): the
// dashboard and data room ARE most of the application; this form only adds
// the ask itself.

interface Check { key: string; label: string; ok: boolean; link: string }
interface Application {
  id: string;
  status: "draft" | "submitted" | "under_review" | "accepted" | "rejected";
  answers: Record<string, string>;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted — waiting for review",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Not this time",
};
const STATUS_ICON: Record<string, any> = { submitted: Clock, under_review: Clock, accepted: CheckCircle, rejected: XCircle };
const STATUS_CLASS: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700",
  under_review: "bg-amber-50 text-amber-700",
  accepted: "bg-[rgba(92,212,94,0.16)] text-[#256b28]",
  rejected: "bg-red-50 text-red-600",
};

const FIELDS: { key: string; label: string; kind: "text" | "textarea"; placeholder: string }[] = [
  { key: "amountSought", label: "How much are you raising?", kind: "text", placeholder: "e.g. $250,000" },
  { key: "roundType", label: "What kind of round?", kind: "text", placeholder: "e.g. Seed extension, SAFE, equity round" },
  { key: "useOfFunds", label: "What would the money be used for?", kind: "textarea", placeholder: "The 2–4 things this capital unlocks…" },
  { key: "tractionNarrative", label: "Where does the business stand today?", kind: "textarea", placeholder: "Revenue, customers, growth since graduation — your numbers on the Dashboard back this up." },
  { key: "timeline", label: "Timeline (optional)", kind: "text", placeholder: "e.g. closing by December" },
];

export default function InvestmentApplication() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ applications: Application[]; readiness: { ready: boolean; checks: Check[]; missing: string[] } }>({
    queryKey: ["investment-applications"],
    queryFn: () => api("/api/investment-applications"),
  });

  const applications = data?.applications ?? [];
  const draft = applications.find((a) => a.status === "draft");
  const pending = applications.find((a) => a.status === "submitted" || a.status === "under_review");
  const past = applications.filter((a) => a.status === "accepted" || a.status === "rejected");
  const readiness = data?.readiness;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!draft || loadedDraftId === draft.id) return;
    setAnswers(Object.fromEntries(Object.entries(draft.answers ?? {}).map(([k, v]) => [k, String(v ?? "")])));
    setLoadedDraftId(draft.id);
  }, [draft, loadedDraftId]);

  function setField(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await api("/api/investment-applications/draft", { method: "POST", body: JSON.stringify({ answers }) });
      showToast("Draft saved.");
      qc.invalidateQueries({ queryKey: ["investment-applications"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't save the draft");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      await api("/api/investment-applications/submit", { method: "POST", body: JSON.stringify({ answers }) });
      showToast("Application submitted. The team has been notified.");
      qc.invalidateQueries({ queryKey: ["investment-applications"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't submit the application");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/" label="Back to Home" />
        <PageHeader
          eyebrow="Alumni"
          title="Apply for the investment plan"
          subtitle="Your dashboard and data room are the application — keep them current, answer a few questions, and submit."
        />

        <div className="mt-8 grid max-w-[1100px] gap-6 lg:grid-cols-[380px,1fr]">
          {/* Readiness checklist */}
          <div className="ost-card h-fit p-6">
            <h2 className="ost-card-title flex items-center gap-2 text-base">
              <Bank className="h-4 w-4 text-secondary" /> Before you can submit
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The review is based on your live data. These need to be in place:
            </p>
            {isLoading || !readiness ? (
              <div className="mt-4"><SkeletonText lines={5} /></div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {readiness.checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2.5 text-sm">
                    {c.ok ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#256b28]" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className={c.ok ? "text-slate-500" : "text-primary"}>
                      {c.label}
                      {!c.ok && (
                        <>
                          {" "}
                          <button onClick={() => navigate(c.link)} className="font-semibold text-secondary hover:underline">
                            Fix it
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right column: status or form */}
          <div className="space-y-6">
            {(pending || past.length > 0) && (
              <div className="ost-card p-6">
                <h2 className="ost-card-title text-base">Your applications</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {[...(pending ? [pending] : []), ...past].map((a) => {
                    const Icon = STATUS_ICON[a.status] ?? Clock;
                    return (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <div className="font-semibold text-primary">
                            {a.answers?.amountSought ? `Seeking ${a.answers.amountSought}` : "Application"}
                          </div>
                          <div className="text-xs text-slate-400">
                            {a.submittedAt ? `Submitted ${new Date(a.submittedAt).toLocaleDateString()}` : ""}
                            {a.decidedAt ? ` · decided ${new Date(a.decidedAt).toLocaleDateString()}` : ""}
                          </div>
                          {a.decisionNote && <div className="mt-1 text-sm text-slate-500">Note from the team: {a.decisionNote}</div>}
                        </div>
                        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[a.status]}`}>
                          <Icon className="h-3.5 w-3.5" /> {STATUS_LABEL[a.status]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {!pending && (
              <div className="ost-card p-6">
                <h2 className="ost-card-title text-base">{past.length > 0 ? "Apply again" : "The ask"}</h2>
                <div className="mt-4 space-y-4">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`inv-${f.key}`} className="ost-label">{f.label}</label>
                      {f.kind === "text" ? (
                        <input id={`inv-${f.key}`} className="ost-input" value={answers[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} maxLength={f.key === "amountSought" || f.key === "roundType" ? 100 : 500} />
                      ) : (
                        <textarea id={`inv-${f.key}`} className="ost-input min-h-[90px]" value={answers[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} maxLength={4000} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button onClick={saveDraft} disabled={saving} className="ost-btn-ghost">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save draft
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting || !readiness?.ready}
                    title={readiness?.ready ? undefined : "Finish the checklist on the left first"}
                    className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit application
                  </button>
                  {!readiness?.ready && !isLoading && (
                    <span className="text-xs text-slate-400">Complete the checklist to unlock Submit.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
