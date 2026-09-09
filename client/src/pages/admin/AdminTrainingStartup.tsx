import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { TrainingModuleHomeworkModal, type TrainingModuleHomeworkRow } from "../../components/admin/TrainingModuleHomeworkModal";
import { MENTORSHIP_SESSION_STATUS_TONES } from "../../lib/statusTones";
import { showToast } from "../../lib/toast";
import { ModalShell } from "../../components/ModalShell";
import { Pencil, Building2, CalendarClock, Paperclip, Presentation, ClipboardList, Loader2, User, Mail, MessageCircle, Linkedin } from "lucide-react";

interface StartupBasic {
  id: string;
  companyName: string;
}

interface TrainerProfile {
  id: string;
  name: string;
  pictureUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

interface TrainingModuleBasic {
  id: string;
  number: number;
  title: string;
}

interface TargetedSession {
  id: string;
  moduleId: string;
  moduleTitle: string | null;
  number: number;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "upcoming" | "completed";
}

interface TrainingSessionNoteRow {
  sessionId: string;
  teamMembersPresence: string | null;
  pointsDiscussed: string | null;
  whatIsGoingWell: string | null;
  whatIsNotGoingWell: string | null;
  actionItems: string | null;
  trainerRating: number | null;
  trainerFeedback: string | null;
}

export default function AdminTrainingStartup() {
  const [, params] = useRoute("/admin/training/:startupId");
  const startupId = params?.startupId ?? "";
  const qc = useQueryClient();
  const [homeworkModalModule, setHomeworkModalModule] = useState<{ moduleId: string; moduleNumber: number; moduleTitle: string } | null>(null);
  const [notesModalSession, setNotesModalSession] = useState<{ sessionId: string; sessionNumber: number; sessionTitle: string } | null>(null);

  const { data: startupData, isLoading: startupLoading } = useQuery<{ startup: StartupBasic; trainingHomework: TrainingModuleHomeworkRow[]; trainingNotes: TrainingSessionNoteRow[] }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  const { data: modulesData } = useQuery<{ modules: TrainingModuleBasic[] }>({
    queryKey: ["admin-training-modules-basic"],
    queryFn: () => api("/api/admin/training/modules"),
  });
  const modules = modulesData?.modules ?? [];

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: TargetedSession[]; trainer: TrainerProfile | null }>({
    queryKey: ["admin-training-sessions", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}/training-sessions`),
    enabled: !!startupId,
  });
  const sessions = sessionsData?.sessions ?? [];
  const trainer = sessionsData?.trainer ?? null;

  if (startupLoading || !startupData) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/training" label="Back to Training" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const startup = startupData.startup;
  const homeworkByModuleId = new Map(startupData.trainingHomework.map((h) => [h.moduleId, h]));
  const notesBySessionId = new Map(startupData.trainingNotes.map((n) => [n.sessionId, n]));

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/training" label="Back to Training" />
        <PageHeader
          eyebrow="Administration · Training"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Manage this startup's trainer, homework, and see which sessions apply to them."
        />

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title text-base">Trainer</h2>
          <p className="ost-helper-text mb-4">Automatically set from whichever trainer is picked for this startup's track sessions in Training.</p>
          {trainer ? (
            <div className="flex items-center gap-3">
              {trainer.pictureUrl ? (
                <img src={trainer.pictureUrl} alt={trainer.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <User className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-primary">{trainer.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {trainer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {trainer.email}</span>}
                  {trainer.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {trainer.whatsapp}</span>}
                  {trainer.linkedinUrl && (
                    <a href={trainer.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-secondary hover:underline">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No trainer picked yet for this startup's track sessions.</p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Homework</h2>
        </div>
        {modules.length === 0 ? (
          <EmptyState icon={Paperclip} title="No modules yet" description="Add a training module first." />
        ) : (
          <div className="mt-3 space-y-2">
            {modules.map((m) => {
              const h = homeworkByModuleId.get(m.id) ?? null;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary">Module {m.number} · {m.title}</div>
                    {h?.submissionFileUrl && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Paperclip className="h-3 w-3" /> Submitted: {h.submissionFileName ?? "file"}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={h?.homeworkUrl ? "teal" : "gray"}>{h?.homeworkUrl ? "Assigned" : "Not assigned"}</StatusBadge>
                    <button
                      onClick={() => setHomeworkModalModule({ moduleId: m.id, moduleNumber: m.number, moduleTitle: m.title })}
                      className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit homework
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Sessions targeting this startup</h2>
          <Link href="/admin/training" className="text-xs font-semibold text-secondary hover:underline">Edit sessions in Training →</Link>
        </div>
        {sessionsLoading ? null : sessions.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No sessions yet" description="Sessions are created and targeted to startups from the Training admin page." />
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => {
              const notes = notesBySessionId.get(s.id) ?? null;
              const hasRecap = Boolean(
                notes && (notes.pointsDiscussed || notes.whatIsGoingWell || notes.whatIsNotGoingWell || notes.actionItems || notes.teamMembersPresence),
              );
              const hasFeedback = Boolean(notes && (notes.trainerRating || notes.trainerFeedback));
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Presentation className="h-3.5 w-3.5 text-secondary" />
                      <p className="text-sm font-semibold text-primary">{s.moduleTitle ? `${s.moduleTitle} · ` : ""}Session {s.number} · {s.title}</p>
                      <StatusBadge tone={MENTORSHIP_SESSION_STATUS_TONES[s.status]}>{s.status}</StatusBadge>
                      <StatusBadge tone={hasRecap ? "teal" : "gray"}>{hasRecap ? "Recap submitted" : "No recap yet"}</StatusBadge>
                      <StatusBadge tone={hasFeedback ? "teal" : "gray"}>{hasFeedback ? "Feedback added" : "No feedback yet"}</StatusBadge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                      <span>{s.durationMinutes} min</span>
                    </div>
                  </div>
                  <button
                    aria-label={`Recap and feedback for ${s.title}`}
                    title="Recap & feedback"
                    onClick={() => setNotesModalSession({ sessionId: s.id, sessionNumber: s.number, sessionTitle: s.title })}
                    className="ost-btn-ghost !shrink-0 !px-3 !py-1.5 text-xs"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Recap &amp; feedback
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {homeworkModalModule && (
        <TrainingModuleHomeworkModal
          startupId={startupId}
          moduleId={homeworkModalModule.moduleId}
          title={`Module ${homeworkModalModule.moduleNumber} · ${homeworkModalModule.moduleTitle}`}
          homework={homeworkByModuleId.get(homeworkModalModule.moduleId) ?? null}
          onClose={() => setHomeworkModalModule(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] })}
        />
      )}

      {notesModalSession && (
        <TrainingSessionNotesModal
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

function TrainingSessionNotesModal({
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
  notes: TrainingSessionNoteRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [trainerRating, setTrainerRating] = useState(notes?.trainerRating ? String(notes.trainerRating) : "");
  const [trainerFeedback, setTrainerFeedback] = useState(notes?.trainerFeedback ?? "");
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
      await api(`/api/admin/startups/${startupId}/training-notes/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          trainerRating: trainerRating ? Number(trainerRating) : undefined,
          trainerFeedback,
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
          <label className="ost-label">Trainer rating (1-5)</label>
          <input type="number" min={1} max={5} className="ost-input" value={trainerRating} onChange={(e) => setTrainerRating(e.target.value)} />
        </div>
      </div>

      <label className="ost-label mt-3">Trainer feedback</label>
      <textarea className="ost-input mb-3 min-h-[60px]" value={trainerFeedback} onChange={(e) => setTrainerFeedback(e.target.value)} />

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
