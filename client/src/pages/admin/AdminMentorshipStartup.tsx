import { useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { parseCsvWithHeader } from "../../lib/csv";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards, SkeletonRows, Skeleton, SkeletonText } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { StatusBadge } from "../../components/StatusBadge";
import { MentorAssignment, type MentorOption } from "../../components/admin/MentorAssignment";
import { MENTORSHIP_SESSION_STATUS_TONES } from "../../lib/statusTones";
import { showToast } from "../../lib/toast";
import { CalendarClock, Pencil, Trash2, Plus, Loader2, Building2, Upload, FileText, ClipboardList } from "lucide-react";

interface Expert {
  id: string;
  name: string;
  bio: string | null;
  industries: string[] | null;
  expertiseAreas: string[] | null;
}

interface CatalogVisibility {
  visibleToAll: boolean;
  visibleStartupIds: string[];
}

interface StartupOption {
  id: string;
  companyName: string;
}

/** Matches a CSV header cell to a field name, forgiving of spacing/casing/punctuation. */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

const HEADER_ALIASES: Record<string, "name" | "bio" | "industries" | "expertiseAreas"> = {
  name: "name",
  bio: "bio",
  biobackground: "bio",
  background: "bio",
  industries: "industries",
  industry: "industries",
  industrytechnology: "industries",
  expertiseareas: "expertiseAreas",
  areasofexpertise: "expertiseAreas",
  expertise: "expertiseAreas",
};

function splitTags(v: string): string[] {
  return v.split(",").map((t) => t.trim()).filter(Boolean);
}

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

interface MentorshipSessionNoteRow {
  sessionId: string;
  teamMembersPresence: string | null;
  pointsDiscussed: string | null;
  whatIsGoingWell: string | null;
  whatIsNotGoingWell: string | null;
  actionItems: string | null;
  mentorRating: number | null;
  mentorFeedback: string | null;
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
  const [notesModalSession, setNotesModalSession] = useState<{ sessionId: string; sessionNumber: number; sessionTitle: string } | null>(null);
  const [editingExpert, setEditingExpert] = useState<Expert | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [visibilityMode, setVisibilityMode] = useState<"all" | "selected" | null>(null);
  const [selectedStartupIds, setSelectedStartupIds] = useState<Set<string>>(new Set());
  const [savingVisibility, setSavingVisibility] = useState(false);

  const { data: startupData, isLoading: startupLoading } = useQuery<{ startup: StartupBasic; mentorshipNotes: MentorshipSessionNoteRow[] }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  const { data: expertsData, isLoading: expertsLoading } = useQuery<{ experts: MentorOption[] }>({
    queryKey: ["admin-experts"],
    queryFn: () => api("/api/admin/experts"),
  });
  const experts = (expertsData?.experts ?? []) as Expert[];

  const { data: allStartupsData } = useQuery<{ startups: StartupOption[] }>({
    queryKey: ["admin-startups"],
    queryFn: () => api("/api/admin/startups"),
  });
  const allStartups = allStartupsData?.startups ?? [];

  const { data: visibilityData } = useQuery<CatalogVisibility>({
    queryKey: ["admin-experts-visibility"],
    queryFn: () => api("/api/admin/experts/visibility"),
  });
  if (visibilityData && visibilityMode === null) {
    setVisibilityMode(visibilityData.visibleToAll ? "all" : "selected");
    setSelectedStartupIds(new Set(visibilityData.visibleStartupIds));
  }

  function invalidateExperts() {
    qc.invalidateQueries({ queryKey: ["admin-experts"] });
  }

  async function removeExpert(e: Expert) {
    if (!confirm(`Delete "${e.name}" from the experts catalog? This can't be undone.`)) return;
    try {
      await api(`/api/admin/experts/${e.id}`, { method: "DELETE" });
      invalidateExperts();
    } catch (err: any) {
      showToast(err.message || "Couldn't delete this expert");
    }
  }

  async function handleCsvFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const records = parseCsvWithHeader(text);
      if (records.length === 0) {
        showToast("That CSV file had no rows to import");
        return;
      }
      const rows = records.map((record) => {
        const mapped: Record<string, string> = {};
        for (const [header, value] of Object.entries(record)) {
          const field = HEADER_ALIASES[normalizeHeader(header)];
          if (field) mapped[field] = value;
        }
        return {
          name: mapped.name ?? "",
          bio: mapped.bio || undefined,
          industries: mapped.industries ? splitTags(mapped.industries) : undefined,
          expertiseAreas: mapped.expertiseAreas ? splitTags(mapped.expertiseAreas) : undefined,
        };
      });
      const result = await api<{ created: number; errors: { row: number; message: string }[] }>("/api/admin/experts/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      invalidateExperts();
      if (result.errors.length === 0) {
        showToast(`Imported ${result.created} expert${result.created === 1 ? "" : "s"}`);
      } else {
        showToast(`Imported ${result.created}, skipped ${result.errors.length} (row ${result.errors[0].row}: ${result.errors[0].message})`);
      }
    } catch (err: any) {
      showToast(err.message || "Couldn't import that CSV file");
    } finally {
      setImporting(false);
    }
  }

  function toggleSelectedStartup(id: string) {
    setSelectedStartupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveVisibility() {
    setSavingVisibility(true);
    try {
      await api("/api/admin/experts/visibility", {
        method: "PATCH",
        body: JSON.stringify({
          visibleToAll: visibilityMode === "all",
          visibleStartupIds: visibilityMode === "selected" ? [...selectedStartupIds] : [],
        }),
      });
      qc.invalidateQueries({ queryKey: ["admin-experts-visibility"] });
      showToast("Visibility saved");
    } catch (e: any) {
      showToast(e.message || "Couldn't save visibility");
    } finally {
      setSavingVisibility(false);
    }
  }

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
  const notesBySessionId = new Map(startupData.mentorshipNotes.map((n) => [n.sessionId, n]));

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
            {sessions.map((s) => {
              const notes = notesBySessionId.get(s.id) ?? null;
              const hasRecap = Boolean(
                notes && (notes.pointsDiscussed || notes.whatIsGoingWell || notes.whatIsNotGoingWell || notes.actionItems || notes.teamMembersPresence),
              );
              const hasFeedback = Boolean(notes && (notes.mentorRating || notes.mentorFeedback));
              return (
                <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-primary">Session {s.number} · {s.title}</p>
                      <StatusBadge tone={MENTORSHIP_SESSION_STATUS_TONES[s.status]}>{s.status}</StatusBadge>
                      <StatusBadge tone={hasRecap ? "teal" : "gray"}>{hasRecap ? "Recap submitted" : "No recap yet"}</StatusBadge>
                      <StatusBadge tone={hasFeedback ? "teal" : "gray"}>{hasFeedback ? "Feedback added" : "No feedback yet"}</StatusBadge>
                    </div>
                    {s.description && <p className="mt-1 text-xs text-slate-500">{s.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                      <span>{s.durationMinutes} min</span>
                      {s.experts && <span>{s.experts}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      aria-label={`Recap and feedback for ${s.title}`}
                      title="Recap & feedback"
                      onClick={() => setNotesModalSession({ sessionId: s.id, sessionNumber: s.number, sessionTitle: s.title })}
                      className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Recap &amp; feedback
                    </button>
                    <button aria-label={`Edit ${s.title}`} title="Edit" onClick={() => setEditingSession(s)} className="ost-btn-ghost !p-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label={`Delete ${s.title}`} title="Delete" onClick={() => removeSession(s)} className="ost-btn-ghost !p-1.5 text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Other experts catalog</h2>
          <span className="text-xs text-slate-400">Shared across every startup</span>
        </div>

        <div className="ost-card mt-3 p-6">
          <p className="ost-label !mb-2">Visible to</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
              <button
                onClick={() => setVisibilityMode("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  visibilityMode === "all" ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"
                }`}
              >
                All startups
              </button>
              <button
                onClick={() => setVisibilityMode("selected")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  visibilityMode === "selected" ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"
                }`}
              >
                Selected startups
              </button>
            </div>
            <button
              onClick={saveVisibility}
              disabled={savingVisibility}
              className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingVisibility && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save visibility
            </button>
          </div>

          {visibilityMode === "selected" && (
            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {allStartups.length === 0 ? (
                <p className="text-sm text-slate-400">No startups yet.</p>
              ) : (
                allStartups.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedStartupIds.has(s.id)}
                      onChange={() => toggleSelectedStartup(s.id)}
                    />
                    {s.companyName}
                  </label>
                ))
              )}
            </div>
          )}

          {visibilityMode === "all" && (
            <p className="mt-3 text-xs text-slate-400">Every startup can browse this catalog on their Mentorship page.</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary">Experts</h3>
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="ost-btn-ghost !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import CSV
            </button>
            <button onClick={() => setEditingExpert("new")} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add expert</button>
          </div>
        </div>

        <div className="ost-card mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Expert</th>
                  <th className="px-5 py-3 font-semibold">Industry / Technology</th>
                  <th className="px-5 py-3 font-semibold">Areas of expertise</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {expertsLoading ? (
                  <SkeletonRows rows={3} cols={4} />
                ) : experts.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-slate-400">No experts yet. Add one or import a CSV.</td></tr>
                ) : (
                  experts.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="max-w-[220px] px-5 py-3">
                        <div className="font-semibold text-primary">{e.name}</div>
                        {e.bio && <div className="mt-0.5 line-clamp-2 text-xs text-slate-400" title={e.bio}>{e.bio}</div>}
                      </td>
                      <td className="max-w-[220px] px-5 py-3 text-slate-500">{(e.industries ?? []).join(", ") || "—"}</td>
                      <td className="max-w-[280px] px-5 py-3 text-slate-500">{(e.expertiseAreas ?? []).join(", ") || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button aria-label={`Edit ${e.name}`} title="Edit" onClick={() => setEditingExpert(e)} className="ost-btn-ghost !p-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button aria-label={`Delete ${e.name}`} title="Delete" onClick={() => removeExpert(e)} className="ost-btn-ghost !p-1.5 text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editingExpert && (
        <ExpertFormModal
          expert={editingExpert === "new" ? null : editingExpert}
          onClose={() => setEditingExpert(null)}
          onSaved={() => { invalidateExperts(); setEditingExpert(null); }}
        />
      )}

      {editingSession && (
        <SessionFormModal
          startupId={startupId}
          session={editingSession === "new" ? null : editingSession}
          nextNumber={sessions.length + 1}
          onClose={() => setEditingSession(null)}
          onSaved={() => { invalidateSessions(); setEditingSession(null); }}
        />
      )}

      {notesModalSession && (
        <SessionNotesModal
          startupId={startupId}
          sessionId={notesModalSession.sessionId}
          title={`Session ${notesModalSession.sessionNumber} — ${notesModalSession.sessionTitle}`}
          notes={notesBySessionId.get(notesModalSession.sessionId) ?? null}
          onClose={() => setNotesModalSession(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] })}
        />
      )}
    </AppShell>
  );
}

function ExpertFormModal({
  expert,
  onClose,
  onSaved,
}: {
  expert: Expert | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(expert?.name ?? "");
  const [bio, setBio] = useState(expert?.bio ?? "");
  const [industries, setIndustries] = useState((expert?.industries ?? []).join(", "));
  const [expertiseAreas, setExpertiseAreas] = useState((expert?.expertiseAreas ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name,
        bio,
        industries: splitTags(industries),
        expertiseAreas: splitTags(expertiseAreas),
      });
      if (expert) {
        await api(`/api/admin/experts/${expert.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/experts", { method: "POST", body });
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
      <h3 className="mb-4 text-lg font-bold text-primary">{expert ? "Edit expert" : "Add expert"}</h3>

      <label className="ost-label">Name</label>
      <input className="ost-input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ozan Sonmez" />

      <label className="ost-label">Bio & background (optional)</label>
      <textarea className="ost-input mb-3 min-h-[90px]" value={bio} onChange={(e) => setBio(e.target.value)} />

      <label className="ost-label">Industry / Technology (comma-separated)</label>
      <input className="ost-input mb-3" value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="e.g. Fintech, Healthtech" />

      <label className="ost-label">Areas of expertise (comma-separated)</label>
      <input className="ost-input mb-3" value={expertiseAreas} onChange={(e) => setExpertiseAreas(e.target.value)} placeholder="e.g. Fundraising, Pricing Strategy" />

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!name.trim() || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {expert ? "Save changes" : "Add expert"}
        </button>
      </div>
    </ModalShell>
  );
}

function SessionNotesModal({
  startupId,
  sessionId,
  title,
  notes,
  onClose,
  onSaved,
}: {
  startupId: string;
  sessionId: string;
  title: string;
  notes: MentorshipSessionNoteRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mentorRating, setMentorRating] = useState(notes?.mentorRating ? String(notes.mentorRating) : "");
  const [mentorFeedback, setMentorFeedback] = useState(notes?.mentorFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recapRows: [string, string | null][] = [
    ["Team members presence", notes?.teamMembersPresence ?? null],
    ["Points discussed", notes?.pointsDiscussed ?? null],
    ["What's going well", notes?.whatIsGoingWell ?? null],
    ["What's not going well", notes?.whatIsNotGoingWell ?? null],
    ["Action items", notes?.actionItems ?? null],
  ];
  const hasRecap = recapRows.some(([, v]) => v);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/startups/${startupId}/mentorship-notes/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          mentorRating: mentorRating ? Number(mentorRating) : undefined,
          mentorFeedback,
        }),
      });
      showToast("Feedback saved");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-primary">{title}</h3>

      <p className="ost-label mb-2">Startup's session recap</p>
      {hasRecap ? (
        <div className="mb-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <tbody>
              {recapRows.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="w-40 py-2 pl-3 pr-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</th>
                  <td className="py-2 pr-3 align-top text-slate-600">{value || <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-400">The startup hasn't submitted a recap for this session yet.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ost-label">Mentor rating (1-5)</label>
          <input type="number" min={1} max={5} className="ost-input" value={mentorRating} onChange={(e) => setMentorRating(e.target.value)} />
        </div>
      </div>

      <label className="ost-label mt-3">Mentor feedback</label>
      <textarea className="ost-input mb-3 min-h-[60px]" value={mentorFeedback} onChange={(e) => setMentorFeedback(e.target.value)} />

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save feedback
        </button>
      </div>
    </ModalShell>
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
