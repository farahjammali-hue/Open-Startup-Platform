import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { showToast } from "../lib/toast";
import { DATA_ROOM_ITEMS } from "@shared/metricsCatalog";
import {
  FolderLock, ArrowSquareOut as ExternalLink, CircleNotch as Loader2, ArrowsClockwise as RefreshCw,
  FileText, UploadSimple, LinkSimple, Copy, Prohibit, Eye,
} from "@phosphor-icons/react";

// Phase 4.9 (revive): the document uploads and the expiring investor share
// links existed on the server since the Data Room was built, but no screen
// ever called them. This page now exposes all three pieces: the external
// link, the uploaded documents, and the share links (viewed by investors at
// /share/data-room/<token> — the PublicDataRoomShare page).

const TABS = [
  { key: "submission", label: "Data room link" },
  { key: "documents", label: "Documents" },
  { key: "sharing", label: "Share with investors" },
];

const CATEGORY_LABELS: Record<string, string> = {
  main_docs: "Main documents",
  legal: "Legal",
  financial: "Financial",
  product: "Product",
  team: "Team",
  fundraising: "Fundraising",
  intellectual_property: "Intellectual property",
  metrics: "Metrics",
  other: "Other",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-[rgba(92,212,94,0.16)] text-[#256b28]",
  rejected: "bg-red-50 text-red-600",
};

interface DocRow {
  id: string;
  title: string;
  category: string;
  checklistKey: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  fileUrl: string;
  fileName: string;
  createdAt: string;
}

interface ShareRow {
  id: string;
  token: string;
  title: string | null;
  documentIds: string[];
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

/** Multipart upload — the shared api() helper is JSON-only. */
async function uploadForm(url: string, form: FormData) {
  const res = await fetch(url, { method: "POST", credentials: "include", body: form });
  const body = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new Error(body?.message || `Upload failed (${res.status})`);
  return body;
}

function LinkTab() {
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

  if (isLoading) return <Skeleton tone="dark" className="h-56 rounded-2xl" />;

  return (
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
          <p className="mt-1 ost-card-subtext">Please, let us know when you've added or updated something.</p>
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
  );
}

function DocumentsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ documents: DocRow[] }>({
    queryKey: ["data-room-documents"],
    queryFn: () => api("/api/documents"),
  });
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("main_docs");
  const [checklistKey, setChecklistKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return showToast("Pick a file to upload");
    if (!title.trim()) return showToast("Give the document a title");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title.trim());
      form.append("category", category);
      if (checklistKey) form.append("checklistKey", checklistKey);
      await uploadForm("/api/documents", form);
      showToast("Document uploaded");
      setTitle("");
      setChecklistKey("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["data-room-documents"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't upload this document");
    } finally {
      setBusy(false);
    }
  }

  async function replaceFile(doc: DocRow, f: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", f);
      await uploadForm(`/api/documents/${doc.id}/replace`, form);
      showToast("File replaced");
      qc.invalidateQueries({ queryKey: ["data-room-documents"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't replace this file");
    } finally {
      setBusy(false);
      setReplacingId(null);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  if (isLoading) return <Skeleton tone="dark" className="h-56 rounded-2xl" />;
  const documents = data?.documents ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="ost-card h-fit p-6">
        <h2 className="ost-card-title flex items-center gap-2 text-base">
          <UploadSimple className="h-4 w-4 text-secondary" /> Upload a document
        </h2>
        <p className="mt-1 ost-card-subtext">PDF, Word, Excel, PowerPoint, or images, up to 20 MB.</p>
        <form onSubmit={upload} className="mt-4 space-y-3">
          <div>
            <label className="ost-label">Title</label>
            <input className="ost-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pitch deck — Sep 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ost-label">Category</label>
              <select className="ost-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="ost-label">Checklist item</label>
              <select className="ost-input" value={checklistKey} onChange={(e) => setChecklistKey(e.target.value)}>
                <option value="">None</option>
                {DATA_ROOM_ITEMS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="ost-label">File</label>
            <input ref={fileRef} type="file" className="ost-input !py-1.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button type="submit" disabled={busy} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Upload
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {documents.length === 0 && (
          <div className="ost-card p-8 text-center text-sm text-slate-400">
            No documents uploaded yet. Documents you upload here can be bundled into investor share links.
          </div>
        )}
        {documents.map((d) => (
          <div key={d.id} className="ost-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-8 w-8 shrink-0 text-secondary" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{d.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {CATEGORY_LABELS[d.category] ?? d.category}
                  {d.checklistKey ? ` · ${DATA_ROOM_ITEMS.find((i) => i.key === d.checklistKey)?.label ?? d.checklistKey}` : ""}
                  {` · ${new Date(d.createdAt).toLocaleDateString()}`}
                </p>
                {d.status === "rejected" && d.reviewNote && <p className="mt-0.5 text-xs text-red-600">Changes requested: {d.reviewNote}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[d.status]}`}>{d.status}</span>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                <ExternalLink className="h-4 w-4" /> Open
              </a>
              <button
                type="button"
                onClick={() => { setReplacingId(d.id); replaceRef.current?.click(); }}
                className="ost-btn-ghost !px-3 !py-1.5 text-xs"
              >
                Replace
              </button>
            </div>
          </div>
        ))}
        <input
          ref={replaceRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            const doc = documents.find((d) => d.id === replacingId);
            if (f && doc) void replaceFile(doc, f);
          }}
        />
      </div>
    </div>
  );
}

function SharingTab() {
  const qc = useQueryClient();
  const { data: docsData } = useQuery<{ documents: DocRow[] }>({
    queryKey: ["data-room-documents"],
    queryFn: () => api("/api/documents"),
  });
  const { data, isLoading } = useQuery<{ shares: ShareRow[] }>({
    queryKey: ["data-room-shares"],
    queryFn: () => api("/api/data-room-shares"),
  });
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const documents = docsData?.documents ?? [];
  const shares = data?.shares ?? [];

  function toggleDoc(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return showToast("Pick at least one document to share");
    setBusy(true);
    try {
      await api("/api/data-room-shares", {
        method: "POST",
        body: JSON.stringify({ title, documentIds: [...selected], expiresInDays: days }),
      });
      showToast("Share link created");
      setTitle("");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["data-room-shares"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't create the share link");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: ShareRow) {
    if (!confirm("Revoke this link? Anyone who has it will lose access immediately.")) return;
    try {
      await api(`/api/data-room-shares/${share.id}/revoke`, { method: "POST" });
      showToast("Link revoked");
      qc.invalidateQueries({ queryKey: ["data-room-shares"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't revoke this link");
    }
  }

  async function copyLink(share: ShareRow) {
    const url = `${window.location.origin}/share/data-room/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      prompt("Copy this link:", url);
    }
  }

  if (isLoading) return <Skeleton tone="dark" className="h-56 rounded-2xl" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="ost-card h-fit p-6">
        <h2 className="ost-card-title flex items-center gap-2 text-base">
          <LinkSimple className="h-4 w-4 text-secondary" /> New share link
        </h2>
        <p className="mt-1 ost-card-subtext">
          A secure, read-only page with the documents you pick. It expires on its own, and you can revoke it any time.
        </p>
        {documents.length === 0 ? (
          <p className="mt-4 rounded-lg bg-[var(--bg-subtle)] p-3 text-sm text-slate-500">
            Upload at least one document (in the Documents tab) to create a share link.
          </p>
        ) : (
          <form onSubmit={create} className="mt-4 space-y-3">
            <div>
              <label className="ost-label">Title (shown to the viewer)</label>
              <input className="ost-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Seed round data room" />
            </div>
            <div>
              <label className="ost-label">Expires in</label>
              <select className="ost-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <div>
              <label className="ost-label">Documents to include</label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {documents.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-600 hover:bg-[var(--bg-subtle)]">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleDoc(d.id)} />
                    <span className="truncate">{d.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create link
            </button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        {shares.length === 0 && (
          <div className="ost-card p-8 text-center text-sm text-slate-400">
            No share links yet. Create one to give an investor a clean, expiring view of chosen documents.
          </div>
        )}
        {shares.map((sh) => {
          const expired = new Date(sh.expiresAt).getTime() < Date.now();
          const dead = !!sh.revokedAt || expired;
          return (
            <div key={sh.id} className={`ost-card flex flex-wrap items-center justify-between gap-3 p-4 ${dead ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{sh.title || "Untitled share"}</p>
                <p className="text-xs text-slate-400">
                  {sh.documentIds.length} document{sh.documentIds.length === 1 ? "" : "s"}
                  {" · "}
                  {sh.revokedAt
                    ? `revoked ${new Date(sh.revokedAt).toLocaleDateString()}`
                    : expired
                      ? `expired ${new Date(sh.expiresAt).toLocaleDateString()}`
                      : `expires ${new Date(sh.expiresAt).toLocaleDateString()}`}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Eye className="h-3.5 w-3.5" /> {sh.viewCount} view{sh.viewCount === 1 ? "" : "s"}
                  {sh.lastViewedAt ? ` · last ${new Date(sh.lastViewedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!dead && (
                  <>
                    <button type="button" onClick={() => copyLink(sh)} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                      <Copy className="h-4 w-4" /> Copy link
                    </button>
                    <a href={`/share/data-room/${sh.token}`} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                      <ExternalLink className="h-4 w-4" /> Preview
                    </a>
                    <button type="button" onClick={() => revoke(sh)} className="ost-btn-ghost !px-3 !py-1.5 text-xs !text-red-600">
                      <Prohibit className="h-4 w-4" /> Revoke
                    </button>
                  </>
                )}
                {sh.revokedAt && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Revoked</span>}
                {!sh.revokedAt && expired && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Expired</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DataRoom() {
  const [tab, setTab] = useState("submission");

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Priority" title="Data room" subtitle="Your documents, your external data room, and secure links for investors." />

        <TabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "submission" && <LinkTab />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "sharing" && <SharingTab />}
      </main>
    </AppShell>
  );
}
