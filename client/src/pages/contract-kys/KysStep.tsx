import { useState } from "react";
import { api } from "../../lib/utils";
import { Field } from "../../components/fields";
import { showToast } from "../../lib/toast";
import { type KysProfile } from "../../lib/kysStatus";
import { ArrowSquareOut as ExternalLink, CircleNotch as Loader2 } from "@phosphor-icons/react";

// Placeholder for now: KYS is collected on an external Typeform instead of
// in-app fields (see the org-level request this replaced). Swap this for the
// real form link once it's ready.
const KYS_FORM_LINK = "#";

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

  async function handleLinkClick() {
    if (!track || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/kys", {
        method: "POST",
        body: JSON.stringify({ track, consentAccepted: true }),
      });
      showToast("KYS marked as submitted.");
      onSubmitted();
    } catch (e: any) {
      setError(e.message || "Couldn't submit the KYS form");
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

      <div className="mt-6 rounded-lg border border-slate-200 bg-offwhite p-5">
        <p className="text-sm font-semibold text-primary">Complete your KYS submission</p>
        <p className="mt-1 text-sm text-slate-500">
          Fill in your Know Your Startup details on the linked form. Once you open it, this step is marked as submitted.
        </p>
        <a
          href={KYS_FORM_LINK}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!track) {
              e.preventDefault();
              setError("Select a program track first.");
              return;
            }
            handleLinkClick();
          }}
          className={`mt-4 inline-flex items-center gap-2 ost-btn-primary ${!track || submitting ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Open the KYS form <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
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
