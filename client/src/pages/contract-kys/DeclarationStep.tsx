import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { DECLARATION_WIDGET_URL } from "../../lib/kysStatus";
import { ArrowSquareOut as ExternalLink, ArrowsClockwise as RefreshIcon, CheckCircle as CheckCircle2, CircleNotch as Loader2, DownloadSimple as Download } from "@phosphor-icons/react";

// Acrobat Sign posts status events to the embedding page; "ESIGN" fires once
// the signer has signed. Only trust messages from Adobe's own https hosts.
// https://opensource.adobe.com/acrobat-sign/developer_guide/events.html
const ADOBE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(adobe\.com|adobesign\.com|echosign\.com)$/i;

function eventType(data: unknown): string | undefined {
  try {
    const d = typeof data === "string" ? JSON.parse(data) : data;
    return typeof (d as any)?.type === "string" ? (d as any).type : undefined;
  } catch {
    return undefined;
  }
}

interface DeclarationStatus {
  signedAt: string | null;
  /** Whether the signed PDF has arrived from Adobe's webhook (it can lag the signature by a minute). */
  hasFile: boolean;
}

/**
 * Step 1: the Certifications & Undertakings declaration, signed in the
 * embedded Acrobat Sign web form. Adobe's webhook then sends the signed PDF
 * back to the platform, where it can be previewed, downloaded, or redone.
 */
export function DeclarationStep({ signed, onSigned, onContinue }: { signed: boolean; onSigned: () => void; onContinue: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A redo shows the signing form again over an existing signature; signing
  // anew replaces the stored PDF and refreshes the date.
  const [redoing, setRedoing] = useState(false);
  const recorded = useRef(false);

  const { data: status } = useQuery<DeclarationStatus>({
    queryKey: ["declaration-status"],
    queryFn: () => api("/api/declaration/status"),
    retryOnMount: false,
    // The webhook's PDF can arrive shortly after the signature: poll briefly
    // while signed-but-fileless so the buttons appear without a manual reload.
    refetchInterval: (q) => (q.state.data && q.state.data.signedAt && !q.state.data.hasFile ? 5000 : false),
  });

  async function markSigned() {
    if (recorded.current || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/declaration/signed", { method: "POST" });
      recorded.current = true;
      setRedoing(false);
      qc.invalidateQueries({ queryKey: ["declaration-status"] });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
      showToast("Declaration signed.");
      onSigned();
    } catch (e: any) {
      setError(e.message || "Your declaration was signed, but we couldn't record it. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!ADOBE_ORIGIN.test(e.origin)) return;
      if (eventType(e.data) === "ESIGN") markSigned();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showForm = !signed || redoing;

  if (!showForm) {
    return (
      <div className="ost-card p-4 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(92,212,94,0.16)] text-[#256b28]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Declaration signed</p>
            <p className="mt-1 text-sm text-slate-500">
              {status?.signedAt && `Signed ${new Date(status.signedAt).toLocaleString()}. `}
              {status?.hasFile
                ? "Your signed copy is below."
                : "Your signed copy is on its way from Adobe — it appears here shortly, and Adobe also emails it to the signer."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {status?.hasFile && (
            <>
              <a href="/api/declaration/file" target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                <ExternalLink className="h-4 w-4" /> Preview
              </a>
              <a href="/api/declaration/file" download="declaration.pdf" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                <Download className="h-4 w-4" /> Download
              </a>
            </>
          )}
          <button type="button" onClick={() => setRedoing(true)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <RefreshIcon className="h-4 w-4" /> Redo the declaration
          </button>
          <button type="button" onClick={onContinue} className="ost-btn-primary !px-4 !py-1.5 text-xs">
            Continue
          </button>
        </div>

        {status?.hasFile && (
          <iframe
            src="/api/declaration/file"
            title="Signed declaration"
            className="mt-5 block w-full rounded-lg border border-slate-200"
            style={{ height: "max(480px, calc(100vh - 380px))" }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="ost-card p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Sign the Certifications &amp; Undertakings</p>
          <p className="mt-1 text-sm text-slate-500">
            Your authorized signatory signs below, using the company's exact legal name and{" "}
            <span className="font-semibold">your account email</span> (so we can file the signed copy under your startup).
            {redoing ? " Signing again replaces your previous declaration." : " Once it's signed, the KYS form opens."}
          </p>
        </div>
        {redoing && (
          <button type="button" onClick={() => setRedoing(false)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            Keep the existing one
          </button>
        )}
      </div>
      {/* Adobe's form needs at least 600px; narrower screens scroll it sideways. */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <iframe
          src={DECLARATION_WIDGET_URL}
          title="Certifications & Undertakings (Adobe Acrobat Sign)"
          className="block w-full min-w-[600px] border-0"
          style={{ height: "max(560px, calc(100vh - 160px))" }}
        />
      </div>

      {saving && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</p>
      )}
      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <button type="button" onClick={markSigned} className="ost-btn-ghost !px-2.5 !py-1 text-xs">Try again</button>
        </div>
      )}

      {!redoing && (
        <p className="mt-4 text-xs text-slate-400">
          Signed it, but this page didn't move on?{" "}
          <button type="button" onClick={markSigned} disabled={saving} className="font-semibold text-secondary hover:underline">
            Continue to the KYS form
          </button>
        </p>
      )}
    </div>
  );
}
