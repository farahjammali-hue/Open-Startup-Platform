import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Widget } from "@typeform/embed-react";
import { api } from "../../lib/utils";
import { useAuth } from "../../lib/auth";
import { Field } from "../../components/fields";
import { showToast } from "../../lib/toast";
import { type KysProfile, KYS_TYPEFORM_ID } from "../../lib/kysStatus";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";

// KYS answers are collected by the embedded Typeform (see KYS_TYPEFORM_ID).
// Answers stay in Typeform; the platform only records that it was submitted.
// The hidden fields let the team match each response to a startup; Typeform
// ignores any that the form doesn't define.

export function KysStep({
  initial,
  onSubmitted,
}: {
  initial?: KysProfile | null;
  onSubmitted: () => void;
}) {
  const [track, setTrack] = useState<"pre_seed" | "seed" | null>(initial?.track ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: startupsData } = useQuery<{ startups: { id: string; companyName: string }[]; activeStartupId: string | null }>({
    queryKey: ["startups"],
    queryFn: () => api("/api/startups"),
  });
  const startup =
    startupsData?.startups.find((s) => s.id === startupsData.activeStartupId) ?? startupsData?.startups[0];

  // Only called from the Typeform's own submit event, so the step completes
  // when the form is actually sent, not when it's merely opened.
  async function markSubmitted() {
    if (!track || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/kys", {
        method: "POST",
        body: JSON.stringify({ track, consentAccepted: true }),
      });
      showToast("KYS submitted.");
      onSubmitted();
    } catch (e: any) {
      setError(e.message || "Your form was sent, but we couldn't record it. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ost-card p-8">
      <Field label="Program track" required>
        <div className="flex flex-wrap gap-2">
          <RadioChip label="Pre-Seed Track" selected={track === "pre_seed"} onClick={() => setTrack("pre_seed")} />
          <RadioChip label="Seed Track" selected={track === "seed"} onClick={() => setTrack("seed")} />
        </div>
      </Field>

      <div className="mt-6">
        <p className="text-sm font-semibold text-primary">Complete your KYC &amp; compliance form</p>
        {!track ? (
          <p className="mt-1 text-sm text-slate-500">Select your program track above to open the form.</p>
        ) : !user || !startup ? (
          <div className="mt-4 flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Fill it in below and press Submit at the end. This step completes once the form is sent.
            </p>
            <Widget
              id={KYS_TYPEFORM_ID}
              hidden={{ startup_id: startup.id, startup_name: startup.companyName, email: user.email }}
              onSubmit={markSubmitted}
              inlineOnMobile
              className="mt-4 overflow-hidden rounded-lg border border-slate-200"
              style={{ height: 640 }}
            />
          </>
        )}
      </div>

      {submitting && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</p>
      )}
      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <button type="button" onClick={markSubmitted} className="ost-btn-ghost !px-2.5 !py-1 text-xs">Try again</button>
        </div>
      )}
    </div>
  );
}

function RadioChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
        selected ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-500 hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}
