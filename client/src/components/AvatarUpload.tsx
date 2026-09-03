import { useRef, useState } from "react";
import { compressImage } from "../lib/image";
import { Upload, Loader2, User as UserIcon } from "lucide-react";

/** Circular profile-photo picker. Stages a Blob + preview; uploaded on Save. */
export function AvatarUpload({
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
      onPick(compressed, url);
    } catch (err: any) {
      setError(err.message || "Couldn't read that image");
    } finally {
      setWorking(false);
      input.value = "";
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
        {preview ? (
          <img src={preview} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-8 w-8 text-slate-300" />
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
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-secondary hover:text-secondary disabled:opacity-50"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {working ? "Reading…" : preview ? "Change photo" : "Upload photo"}
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          PNG, JPG or WebP · Saved when you click Save changes
        </p>
        {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
      </div>
    </div>
  );
}
