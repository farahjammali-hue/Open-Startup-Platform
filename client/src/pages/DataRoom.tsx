import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { showToast } from "../lib/toast";
import { FolderLock, ExternalLink, Loader2, RefreshCw } from "lucide-react";

const TABS = [{ key: "submission", label: "Data room submission" }];

export default function DataRoom() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ dataRoomLink: string | null; dataRoomUpdatedAt: string | null }>({
    queryKey: ["data-room"],
    queryFn: () => api("/api/data-room"),
  });
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setValue(data.dataRoomLink ?? "");
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/data-room", { method: "PATCH", body: JSON.stringify({ dataRoomLink: value }) });
      qc.invalidateQueries({ queryKey: ["data-room"] });
      showToast("Data room link saved");
    } catch (e: any) {
      setError(e.message || "Couldn't save this link");
    } finally {
      setSaving(false);
    }
  }

  async function markUpdated() {
    setMarking(true);
    try {
      await api("/api/data-room/mark-updated", { method: "POST" });
      qc.invalidateQueries({ queryKey: ["data-room"] });
      showToast("Marked as updated");
    } catch (e: any) {
      showToast(e.message || "Couldn't mark this as updated");
    } finally {
      setMarking(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Priority" title="Data room" subtitle="Share where your documents live, we'll take it from there." />

        <TabBar tabs={TABS} active="submission" onChange={() => {}} />

        {isLoading ? (
          <Skeleton tone="dark" className="h-56 rounded-2xl" />
        ) : (
          <div className="ost-card max-w-xl p-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <FolderLock className="h-6 w-6" />
            </div>
            <h2 className="ost-card-title">Your data room</h2>
            <p className="mt-1.5 ost-card-subtext">
              Add the link to your data room, hosted on Google Drive, Dropbox, Notion, DocSend, or another platform.
            </p>

            <form onSubmit={save} className="mt-6 space-y-3">
              <div>
                <label className="ost-label">Data room link</label>
                <input
                  type="url"
                  className="ost-input"
                  placeholder="https://drive.google.com/…"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="submit" disabled={saving} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save link
                </button>
                {data?.dataRoomLink && (
                  <a href={data.dataRoomLink} target="_blank" rel="noreferrer" className="ost-btn-ghost">
                    <ExternalLink className="h-4 w-4" /> Open data room
                  </a>
                )}
              </div>
            </form>

            {data?.dataRoomLink && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-primary">Made changes inside your data room?</p>
                <p className="mt-1 ost-card-subtext">
                  Please, let us know when you've added or updated something.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={markUpdated} disabled={marking} className="ost-btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
                    {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Mark as updated
                  </button>
                  {data.dataRoomUpdatedAt && (
                    <span className="text-xs text-slate-400">Last marked updated {new Date(data.dataRoomUpdatedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
