import { useRef, useState } from "react";
import { Loader2, Lock, Globe, Upload, ImageIcon, FileText, ExternalLink } from "lucide-react";

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 400;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => reject(new Error("Failed to read image"));
    img.src = objectUrl;
  });
}

export function LogoUpload({
  preview,
  onPick,
}: {
  preview: string | null;
  onPick: (blob: Blob, previewUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;
    setError(null);
    setWorking(true);
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      onPick(compressed, url); // stage only — uploaded on Save
    } catch (err: any) {
      setError(err.message || "Couldn't read that image");
    } finally {
      setWorking(false);
      input.value = "";
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
        {preview ? (
          <img src={preview} alt="Logo" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-slate-300" />
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFile}
          disabled={working}
        />
        <button
          type="button"
          disabled={working}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
            working
              ? "cursor-not-allowed opacity-50"
              : "border-slate-200 text-slate-600 hover:border-secondary hover:text-secondary"
          }`}
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {working ? "Reading…" : preview ? "Change logo" : "Select logo"}
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          PNG, JPG, SVG or WebP · Resized to 400 × 400 px · Saved when you click Save changes
        </p>
        {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export function DeckUpload({
  existingUrl,
  file,
  disabled,
  onPick,
}: {
  existingUrl: string | null;
  file: File | null;
  disabled?: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    const input = e.target;
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are accepted.");
      input.value = "";
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      setError("That file is over 30 MB.");
      input.value = "";
      return;
    }
    setError(null);
    onPick(f);
    input.value = "";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={handleFile}
          disabled={disabled}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {file || existingUrl ? "Replace PDF" : "Upload PDF"}
        </button>

        {file ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-primary">
            <FileText className="h-4 w-4 text-secondary" /> {file.name} (will save)
          </span>
        ) : existingUrl ? (
          <a
            href={existingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
          >
            <FileText className="h-4 w-4" /> Current deck <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-sm text-slate-400">No deck uploaded yet</span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        PDF only · Max 30 MB{disabled ? " · Save the basics first" : " · Saved when you click Save changes"}
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-6 first:border-0 first:pt-0">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function Counter({ value, max }: { value: number; max: number }) {
  return <p className="mt-1 text-right text-xs text-slate-400">{value}/{max}</p>;
}

export function LinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      <input
        type="url"
        className="ost-input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://"
      />
    </div>
  );
}

export function Money({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        type="number"
        min={0}
        className="ost-input pl-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

export function YesNo({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[{ label: "Yes", v: true }, { label: "No", v: false }].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-lg border px-5 py-2 text-sm font-semibold transition ${
            value === o.v
              ? "border-secondary bg-secondary text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? "" : o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "border-secondary bg-secondary text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MultiPills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((x) => x !== o.value) : [...value, o.value])
            }
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "border-secondary bg-secondary text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function VideoRow({
  label,
  hint,
  url,
  onUrl,
  isPrivate,
  onPrivate,
}: {
  label: string;
  hint: string;
  url: string;
  onUrl: (v: string) => void;
  isPrivate: boolean;
  onPrivate: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="ost-label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="url"
          className="ost-input"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="YouTube / Vimeo URL"
        />
        <button
          type="button"
          onClick={() => onPrivate(!isPrivate)}
          title={isPrivate ? "Private" : "Public"}
          className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition ${
            isPrivate
              ? "border-secondary bg-secondary/10 text-secondary"
              : "border-slate-200 text-slate-400 hover:border-secondary"
          }`}
        >
          <Lock className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
