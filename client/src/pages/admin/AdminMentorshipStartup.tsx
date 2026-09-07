import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards, Skeleton, SkeletonText } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { StatusBadge } from "../../components/StatusBadge";
import { MentorAssignment, type MentorOption } from "../../components/admin/MentorAssignment";
import { MENTORSHIP_SESSION_STATUS_TONES } from "../../lib/statusTones";
import { showToast } from "../../lib/toast";
import { CalendarClock, Pencil, Trash2, Plus, Loader2, Building2, Upload, FileText } from "lucide-react";

interface MentorshipSession {
  id: string;
  number: number;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  experts: string | null;
  mentorBio: string | null;
  status: "upcoming" | "completed";
  meetingLink: string | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  materialsUrl: string | null;
  zoomHostEmail: string | null;
}

interface ZoomHost { id: string; email: string; name: string; }

interface StartupBasic {
  id: string;
  companyName: string;
  mentorId: string | null;
}

/** datetime-local expects local time, no timezone suffix. */
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminMentorshipStartup() {
  const [, params] = useRoute("/admin/mentorship/:startupId");
  const startupId = params?.startupId ?? "";
  const qc = useQueryClient();
  const [editingSession, setEditingSession] = useState<MentorshipSession | "new" | null>(null);

  const { data: startupData, isLoading: startupLoading } = useQuery<{ startup: StartupBasic }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  const { data: expertsData } = useQuery<{ experts: MentorOption[] }>({
    queryKey: ["admin-experts"],
    queryFn: () => api("/api/admin/experts"),
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: MentorshipSession[] }>({
    queryKey: ["admin-mentorship-sessions", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}/mentorship-sessions`),
    enabled: !!startupId,
  });
  const sessions = sessionsData?.sessions ?? [];

  function invalidateSessions() {
    qc.invalidateQueries({ queryKey: ["admin-mentorship-sessions", startupId] });
  }

  async function removeSession(s: MentorshipSession) {
    if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
    try {
      await api(`/api/admin/startups/${startupId}/mentorship-sessions/${s.id}`, { method: "DELETE" });
      invalidateSessions();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this session");
    }
  }

  if (startupLoading || !startupData) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/mentorship" label="Back to Mentorship" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const startup = startupData.startup;

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/mentorship" label="Back to Mentorship" />
        <PageHeader
          eyebrow="Administration · Mentorship"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Manage this startup's mentor and mentorship sessions."
        />

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title mb-4 text-base">Mentor</h2>
          <MentorAssignment
            startupId={startupId}
            currentMentorId={startup.mentorId}
            mentors={expertsData?.experts ?? []}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] })}
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Sessions</h2>
          <button onClick={() => setEditingSession("new")} className="ost-btn-primary !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add session</button>
        </div>

        {sessionsLoading ? (
          <div className="mt-3"><SkeletonCards count={3} /></div>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.length === 0 && (
              <EmptyState icon={CalendarClock} title="No sessions yet" description="Add this startup's first mentorship session." />
            )}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-primary">Session {s.number} · {s.title}</p>
                    <StatusBadge tone={MENTORSHIP_SESSION_STATUS_TONES[s.status]}>{s.status}</StatusBadge>
                  </div>
                  {s.description && <p className="mt-1 text-xs text-slate-500">{s.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                    <span>{s.durationMinutes} min</span>
                    {s.experts && <span>{s.experts}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label={`Edit ${s.title}`} title="Edit" onClick={() => setEditingSession(s)} className="ost-btn-ghost !p-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label={`Delete ${s.title}`} title="Delete" onClick={() => removeSession(s)} className="ost-btn-ghost !p-1.5 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editingSession && (
        <SessionFormModal
          startupId={startupId}
          session={editingSession === "new" ? null : editingSession}
          nextNumber={sessions.length + 1}
          onClose={() => setEditingSession(null)}
          onSaved={() => { invalidateSessions(); setEditingSession(null); }}
        />
      )}
    </AppShell>
  );
}

function SessionFormModal({
  startupId,
  session,
  nextNumber,
  onClose,
  onSaved,
}: {
  startupId: string;
  session: MentorshipSession | null;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(String(session?.number ?? nextNumber));
  const [title, setTitle] = useState(session?.title ?? "");
  const [description, setDescription] = useState(session?.description ?? "");
  const [scheduledAt, setScheduledAt] = useState(session ? toDatetimeLocal(new Date(session.scheduledAt)) : "");
  const [durationMinutes, setDurationMinutes] = useState(String(session?.durationMinutes ?? 120));
  const [mentorBio, setMentorBio] = useState(session?.mentorBio ?? "");
  const [status, setStatus] = useState<"upcoming" | "completed">(session?.status ?? "upcoming");
  const [meetingLink, setMeetingLink] = useState(session?.meetingLink ?? "");
  const [zoomHostEmail, setZoomHostEmail] = useState(session?.zoomHostEmail ?? "");
  const [recordingUrl, setRecordingUrl] = useState(session?.recordingUrl ?? "");
  const [transcriptUrl, setTranscriptUrl] = useState(session?.transcriptUrl ?? "");
  const [materialsUrl, setMaterialsUrl] = useState(session?.materialsUrl ?? "");
  const [materialsFileName, setMaterialsFileName] = useState<string | null>(
    session?.materialsUrl ? session.materialsUrl.split("/").pop() ?? null : null,
  );
  const [uploadingMaterials, setUploadingMaterials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: zoomData, isLoading: zoomHostsLoading } = useQuery<{ hosts: ZoomHost[] }>({
    queryKey: ["zoom-hosts"],
    queryFn: () => api("/api/admin/zoom/hosts"),
    retry: false,
  });
  const { data: expertsData } = useQuery<{ experts: MentorOption[] }>({
    queryKey: ["admin-experts"],
    queryFn: () => api("/api/admin/experts"),
  });
  const experts = expertsData?.experts ?? [];
  const initialExpert = experts.find((e) => e.name === session?.experts) ?? null;
  const [selectedExpertId, setSelectedExpertId] = useState(initialExpert?.id ?? "");

  async function uploadMaterials(file: File) {
    setUploadingMaterials(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/mentorship-materials", { method: "POST", credentials: "include", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Upload failed");
      setMaterialsUrl(body.fileUrl);
      setMaterialsFileName(body.fileName);
    } catch (e: any) {
      showToast(e.message || "Couldn't upload that file");
    } finally {
      setUploadingMaterials(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        number: Number(number) || 1,
        title,
        description,
        scheduledAt,
        durationMinutes: Number(durationMinutes) || 120,
        experts: experts.find((e) => e.id === selectedExpertId)?.name ?? "",
        mentorBio,
        status,
        meetingLink,
        zoomHostEmail,
        recordingUrl,
        transcriptUrl,
        materialsUrl,
      });
      if (session) {
        await api(`/api/admin/startups/${startupId}/mentorship-sessions/${session.id}`, { method: "PATCH", body });
      } else {
        await api(`/api/admin/startups/${startupId}/mentorship-sessions`, { method: "POST", body });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-primary">{session ? "Edit session" : "Add session"}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ost-label">Session number</label>
          <input type="number" min={1} className="ost-input" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div>
          <label className="ost-label">Status</label>
          <select className="ost-input" value={status} onChange={(e) => setStatus(e.target.value as "upcoming" | "completed")}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <label className="ost-label mt-3">Title</label>
      <input className="ost-input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Customer discovery deep dive" />

      <label className="ost-label">Description (optional)</label>
      <textarea className="ost-input mb-3 min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ost-label">Date & time</label>
          <input type="datetime-local" className="ost-input" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <div>
          <label className="ost-label">Duration (minutes)</label>
          <input type="number" className="ost-input" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </div>
      </div>

      <label className="ost-label mt-3">Expert</label>
      <select className="ost-input mb-3" value={selectedExpertId} onChange={(e) => setSelectedExpertId(e.target.value)}>
        <option value="">No expert selected</option>
        {experts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      <label className="ost-label">Mentor bio (optional, shown to founders)</label>
      <textarea className="ost-input mb-3 min-h-[50px]" value={mentorBio} onChange={(e) => setMentorBio(e.target.value)} placeholder="Short bio describing the mentor's background" />

      <label className="ost-label">Zoom host (optional)</label>
      <select
        className="ost-input mb-1"
        value={zoomHostEmail}
        onChange={(e) => {
          const next = e.target.value;
          setZoomHostEmail(next);
          // Clearing the host cancels the meeting the platform created, so
          // don't leave its now-dead join link sitting in the manual field.
          if (!next && session?.zoomHostEmail) setMeetingLink("");
        }}
        disabled={zoomHostsLoading}
      >
        <option value="">Create no Zoom meeting</option>
        {(zoomData?.hosts ?? []).map((host) => <option key={host.id} value={host.email}>{host.name} — {host.email}</option>)}
      </select>
      {zoomHostEmail ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {session?.zoomHostEmail === zoomHostEmail
            ? "The platform keeps this Zoom meeting's title, date and duration in sync when you save."
            : "A Zoom meeting and participant join link will be created automatically when you save."}
        </p>
      ) : (
        <>
          {session?.zoomHostEmail ? (
            <p className="mb-2 text-sm text-red-600">Saving will cancel the Zoom meeting the platform created for this session.</p>
          ) : null}
          <label className="ost-label">Meeting link (optional)</label>
          <input className="ost-input mb-3" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" />
        </>
      )}

      <label className="ost-label">Recording link</label>
      <input className="ost-input mb-3" value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Transcript link</label>
      <input className="ost-input mb-3" value={transcriptUrl} onChange={(e) => setTranscriptUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Materials (link, or upload a PDF/Word doc)</label>
      <div className="mb-1 flex items-center gap-2">
        <input
          className="ost-input"
          value={materialsUrl}
          onChange={(e) => { setMaterialsUrl(e.target.value); setMaterialsFileName(null); }}
          placeholder="https://…"
        />
        <label className="ost-btn-ghost cursor-pointer whitespace-nowrap !px-3 !py-1.5 text-xs">
          {uploadingMaterials ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={uploadingMaterials}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMaterials(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {materialsFileName && (
        <p className="mb-3 flex items-center gap-1 text-xs text-slate-400"><FileText className="h-3 w-3" /> Uploaded: {materialsFileName}</p>
      )}
      {!materialsFileName && <div className="mb-3" />}

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!title.trim() || !scheduledAt || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {session ? "Save changes" : "Add session"}
        </button>
      </div>
    </ModalShell>
  );
}
