import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { Field } from "../../components/fields";
import { showToast } from "../../lib/toast";
import { type KysDocument, type KysProfile } from "../../lib/kysStatus";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";

type DocType = KysDocument["docType"];

const IRS_FORMS = [
  { value: "w9", label: "W-9 (US persons/entities)" },
  { value: "w8ben", label: "W-8BEN (non-US individual)" },
  { value: "w8bene", label: "W-8BEN-E (non-US entity)" },
] as const;

export function KysStep({
  initial,
  defaultStartupName,
  documents,
  onSubmitted,
}: {
  initial?: KysProfile | null;
  defaultStartupName: string;
  documents: KysDocument[];
  onSubmitted: () => void;
}) {
  const qc = useQueryClient();
  const [track, setTrack] = useState<"pre_seed" | "seed" | null>(initial?.track ?? null);
  const [startupName, setStartupName] = useState(defaultStartupName);
  const [incorporated, setIncorporated] = useState<boolean | null>(initial?.incorporated ?? null);

  // Path A (incorporated)
  const [addr1, setAddr1] = useState(initial?.addressLine1 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [incDate, setIncDate] = useState(initial?.incorporationDate ?? "");
  const [tin, setTin] = useState(initial?.tin ?? "");
  const [signatoryName, setSignatoryName] = useState(initial?.signatoryName ?? "");
  const [signatoryPhone, setSignatoryPhone] = useState(initial?.signatoryPhone ?? "");
  const [signatoryEmail, setSignatoryEmail] = useState(initial?.signatoryEmail ?? "");
  const [irsForm, setIrsForm] = useState<string | null>(initial?.irsForm ?? null);
  const [consent, setConsent] = useState(initial?.consentAccepted ?? false);

  // Path B (not incorporated)
  const [repName, setRepName] = useState(initial?.repName ?? "");
  const [repPhone, setRepPhone] = useState(initial?.repPhone ?? "");
  const [repEmail, setRepEmail] = useState(initial?.repEmail ?? "");
  const [disclaimer, setDisclaimer] = useState<boolean | null>(initial?.disclaimerAccepted ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docByType = new Map(documents.map((d) => [d.docType, d]));
  const hasDoc = (t: DocType) => docByType.has(t);

  const pathAFields = [track, startupName, incorporated, addr1, city, country, incDate, tin, signatoryName, signatoryPhone, signatoryEmail, irsForm, hasDoc("certificate_of_incorporation"), hasDoc("banking"), consent];
  const pathBFields = [track, startupName, incorporated, repName, repPhone, repEmail, hasDoc("identity_document"), disclaimer, consent];
  const activeFields = incorporated === false ? pathBFields : pathAFields;
  const filled = activeFields.filter((f) => f !== null && f !== "" && f !== undefined && f !== false).length;
  const pct = Math.round((filled / activeFields.length) * 100);

  const canSubmit =
    !submitting &&
    track && startupName.trim() && incorporated !== null && consent &&
    (incorporated
      ? addr1 && city && country && incDate && tin && signatoryName && signatoryPhone && signatoryEmail && irsForm && hasDoc("certificate_of_incorporation") && hasDoc("banking")
      : repName && repPhone && repEmail && hasDoc("identity_document") && disclaimer !== null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/kys", {
        method: "POST",
        body: JSON.stringify({
          track,
          incorporated,
          consentAccepted: consent,
          ...(incorporated
            ? {
                addressLine1: addr1,
                city,
                country,
                incorporationDate: incDate,
                tin,
                signatoryName,
                signatoryPhone,
                signatoryEmail,
                irsForm,
              }
            : {
                repName,
                repPhone,
                repEmail,
                disclaimerAccepted: disclaimer,
              }),
        }),
      });
      showToast("KYS profile submitted.");
      onSubmitted();
    } catch (e: any) {
      setError(e.message || "Couldn't submit the KYS form");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDoc(docType: DocType, file: File) {
    const fd = new FormData();
    fd.append("docType", docType);
    fd.append("file", file);
    const res = await fetch("/api/kys/documents", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "Upload failed");
    }
    qc.invalidateQueries({ queryKey: ["kys"] });
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-bold text-white/60">KYS completion</span>
          <span className="text-lg font-extrabold text-secondary-300">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF3D82, #62DDD1)" }} />
        </div>
      </div>

      <div className="ost-card p-8">
        <fieldset className="mb-6 border-b border-slate-200 pb-6">
          <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">1 · Basic information</legend>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label="Program track" required>
              <div className="flex flex-wrap gap-2">
                <RadioChip label="Pre-Seed Track" selected={track === "pre_seed"} onClick={() => setTrack("pre_seed")} />
                <RadioChip label="Seed Track" selected={track === "seed"} onClick={() => setTrack("seed")} />
              </div>
            </Field>
            <Field label="Startup name" required>
              <input className="ost-input" value={startupName} onChange={(e) => setStartupName(e.target.value)} placeholder="e.g. Guepard" />
            </Field>
          </div>
          <Field label="Is your startup legally incorporated?" required>
            <div className="flex gap-2">
              <RadioChip label="Yes" selected={incorporated === true} onClick={() => setIncorporated(true)} />
              <RadioChip label="No" selected={incorporated === false} onClick={() => setIncorporated(false)} />
            </div>
          </Field>
        </fieldset>

        {incorporated === true && (
          <>
            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">2 · General information &amp; proof of legal status</legend>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field label="Registered address" required><input className="ost-input" value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="Address line 1" /></Field>
                <Field label="City / town" required><input className="ost-input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              </div>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field label="Country" required><input className="ost-input" value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
                <Field label="Date of incorporation" required><input type="date" className="ost-input" value={incDate} onChange={(e) => setIncDate(e.target.value)} /></Field>
              </div>
              <Field label="Tax Identification Number (TIN/VAT/GST/EIN)" required>
                <input className="ost-input" value={tin} onChange={(e) => setTin(e.target.value)} />
              </Field>
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">3 · Authorized signatory</legend>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required><input className="ost-input" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} /></Field>
                <Field label="Phone" required><input type="tel" className="ost-input" value={signatoryPhone} onChange={(e) => setSignatoryPhone(e.target.value)} placeholder="+1 (201) 555-0123" /></Field>
              </div>
              <Field label="Email" required><input type="email" className="ost-input" value={signatoryEmail} onChange={(e) => setSignatoryEmail(e.target.value)} /></Field>
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">4 · Required documents</legend>
              <UploadRow label="Certificate of Incorporation" required doc={docByType.get("certificate_of_incorporation")} onUpload={(f) => uploadDoc("certificate_of_incorporation", f)} />
              <UploadRow label="Proof of registered address" doc={docByType.get("proof_of_address")} onUpload={(f) => uploadDoc("proof_of_address", f)} />
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">5 · IRS form</legend>
              <Field label="Select the applicable form" required>
                <div className="flex flex-wrap gap-2">
                  {IRS_FORMS.map((f) => (
                    <RadioChip key={f.value} label={f.label} selected={irsForm === f.value} onClick={() => setIrsForm(f.value)} />
                  ))}
                </div>
              </Field>
              {irsForm && <UploadRow label={`Signed ${IRS_FORMS.find((f) => f.value === irsForm)?.label.split(" ")[0]} form`} required doc={docByType.get("irs_form")} onUpload={(f) => uploadDoc("irs_form", f)} />}
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">6 · Banking &amp; payments</legend>
              <UploadRow label="Voided check or bank letter" required doc={docByType.get("banking")} onUpload={(f) => uploadDoc("banking", f)} />
            </fieldset>

            <fieldset>
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">7 · Declaration &amp; consent</legend>
              <UploadRow label="Signed declaration form (optional)" doc={docByType.get("declaration")} onUpload={(f) => uploadDoc("declaration", f)} />
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-primary">
                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I acknowledge that confidential and sensitive data will be shared with OST for compliance and operational purposes, and I consent to its secure handling.
              </label>
            </fieldset>
          </>
        )}

        {incorporated === false && (
          <>
            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">2 · Authorized representative</legend>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required><input className="ost-input" value={repName} onChange={(e) => setRepName(e.target.value)} /></Field>
                <Field label="Phone" required><input type="tel" className="ost-input" value={repPhone} onChange={(e) => setRepPhone(e.target.value)} placeholder="+1 (201) 555-0123" /></Field>
              </div>
              <Field label="Email" required><input type="email" className="ost-input" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} /></Field>
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">3 · Identity document</legend>
              <UploadRow label="Government-issued ID" required doc={docByType.get("identity_document")} onUpload={(f) => uploadDoc("identity_document", f)} />
            </fieldset>

            <fieldset className="mb-6 border-b border-slate-200 pb-6">
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">4 · Fellowship funds disclaimer</legend>
              <p className="mb-4 text-sm text-slate-500">
                As your startup is not yet legally incorporated, fellowship funds cannot be disbursed directly to founders. Funds may only be used for eligible expenses via direct payment to approved service providers until incorporation is complete.
              </p>
              <div className="flex gap-2">
                <RadioChip label="I accept" selected={disclaimer === true} onClick={() => setDisclaimer(true)} />
                <RadioChip label="I don't accept" selected={disclaimer === false} onClick={() => setDisclaimer(false)} />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-4 w-full border-b border-slate-200 pb-4 text-sm font-extrabold text-primary">5 · Declaration &amp; consent</legend>
              <UploadRow label="Signed declaration form (optional)" doc={docByType.get("declaration")} onUpload={(f) => uploadDoc("declaration", f)} />
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-primary">
                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I acknowledge that confidential and sensitive data will be shared with OST for compliance and operational purposes, and I consent to its secure handling.
              </label>
            </fieldset>
          </>
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

        {incorporated !== null && !canSubmit && !error && (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-amber-bg p-4 text-sm text-amber-text">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><b className="block">Almost there.</b> Complete the required fields above to submit your KYS profile.</div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" disabled={!canSubmit} onClick={handleSubmit} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit KYS Form
          </button>
        </div>
      </div>
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

function UploadRow({
  label,
  required,
  doc,
  onUpload,
}: {
  label: string;
  required?: boolean;
  doc?: KysDocument;
  onUpload: (file: File) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-semibold text-primary">
          {label} {required ? <span className="ml-1 ost-helper-text font-bold text-red-500">Required</span> : <span className="ml-1 ost-helper-text font-bold">Optional</span>}
        </div>
        {doc && <div className="mt-1 ost-helper-text">{doc.fileName}</div>}
        {error && <div className="mt-1 text-xs font-medium text-red-500">{error}</div>}
      </div>
      <label className="ost-btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : doc ? "Replace" : "Upload"}
        <input type="file" className="hidden" disabled={busy} onChange={handleChange} />
      </label>
    </div>
  );
}
