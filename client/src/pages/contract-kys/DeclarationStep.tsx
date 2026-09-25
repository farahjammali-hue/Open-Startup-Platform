import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/utils";
import { showToast } from "../../lib/toast";
import { DECLARATION_WIDGET_URL } from "../../lib/kysStatus";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";

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

/**
 * Step 1: the Certifications & Undertakings declaration, signed in the
 * embedded Acrobat Sign web form. The signed copy lives in Adobe; the
 * platform only records that it was signed so the KYS step can open.
 */
export function DeclarationStep({ onSigned }: { onSigned: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorded = useRef(false);

  async function markSigned() {
    if (recorded.current || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/declaration/signed", { method: "POST" });
      recorded.current = true;
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

  return (
    <div className="ost-card p-4 sm:p-8">
      <p className="text-sm font-semibold text-primary">Sign the Certifications &amp; Undertakings</p>
      <p className="mt-1 text-sm text-slate-500">
        Your authorized signatory signs below, using the company's exact legal name. Once it's signed, the KYS form opens.
      </p>
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

      <p className="mt-4 text-xs text-slate-400">
        Signed it, but this page didn't move on?{" "}
        <button type="button" onClick={markSigned} disabled={saving} className="font-semibold text-secondary hover:underline">
          Continue to the KYS form
        </button>
      </p>
    </div>
  );
}
