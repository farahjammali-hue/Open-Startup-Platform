import { useState } from "react";
import { showToast } from "../../lib/toast";
import type { Contract } from "../../lib/kysStatus";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";

export function ContractStep({ initial, onSigned }: { initial?: Contract | null; onSigned: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contract/upload", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Couldn't upload the signed contract");
      }
      showToast("Contract uploaded. Continue to KYS.");
      onSigned();
    } catch (e: any) {
      setError(e.message || "Couldn't upload the signed contract");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ost-card p-8">
      <h2 className="ost-card-title text-lg">Program Agreement</h2>
      <p className="mb-6 mt-1 ost-card-subtext">
        Sign the program agreement on your side, then upload the signed copy here as a PDF.
      </p>

      {initial?.fileUrl && (
        <a
          href={initial.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-primary hover:border-secondary"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" /> {initial.fileName ?? "Uploaded contract"}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>
      )}

      <div className="flex h-[130px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-[#fbfbfa] text-sm text-slate-500">
        <Upload className="h-4 w-4" />
        <span>{file ? file.name : "Choose the signed contract PDF"}</span>
        <label className="ost-btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
          {initial?.fileUrl ? "Replace file" : "Choose file"}
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button type="button" disabled={!file || busy} onClick={handleUpload} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Upload Contract
        </button>
      </div>
    </div>
  );
}
