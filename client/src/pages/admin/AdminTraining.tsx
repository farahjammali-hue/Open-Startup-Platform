import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCards } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { StatusBadge } from "../../components/StatusBadge";
import { MENTORSHIP_SESSION_STATUS_TONES } from "../../lib/statusTones";
import { showToast } from "../../lib/toast";
import {
  Layers, Lock, Unlock, Pencil, Trash2, Plus, Loader2, ChevronDown, ChevronUp, User, Mail, MessageCircle, Linkedin, Camera,
} from "lucide-react";

interface Trainer {
  id: string;
  name: string;
  introduction: string | null;
  pictureUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

interface TrainingSession {
  id: string;
  moduleId: string;
  number: number;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  experts: string | null;
  trainerBio: string | null;
  status: "upcoming" | "completed";
  meetingLink: string | null;
  presentationUrl: string | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
}

interface TrainingModule {
  id: string;
  number: number;
  title: string;
  description: string | null;
  durationLabel: string | null;
  unlocked: boolean;
  sessions: TrainingSession[];
}

/** datetime-local expects local time, no timezone suffix. */
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminTraining() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<TrainingModule | "new" | null>(null);
  const [editingSession, setEditingSession] = useState<{ moduleId: string; session: TrainingSession | null } | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | "new" | null>(null);

  const { data, isLoading } = useQuery<{ modules: TrainingModule[] }>({
    queryKey: ["admin-training"],
    queryFn: () => api("/api/admin/training/modules"),
  });
  const modules = data?.modules ?? [];

  const { data: trainersData, isLoading: trainersLoading } = useQuery<{ trainers: Trainer[] }>({
    queryKey: ["admin-trainers"],
    queryFn: () => api("/api/admin/trainers"),
  });
  const trainers = trainersData?.trainers ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-training"] });
  }

  function invalidateTrainers() {
    qc.invalidateQueries({ queryKey: ["admin-trainers"] });
  }

  async function removeTrainer(t: Trainer) {
    if (!confirm(`Delete "${t.name}"? Any startup they're assigned to will be unassigned.`)) return;
    try {
      await api(`/api/admin/trainers/${t.id}`, { method: "DELETE" });
      invalidateTrainers();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this trainer");
    }
  }

  async function toggleUnlock(m: TrainingModule) {
    try {
      await api(`/api/admin/training/modules/${m.id}`, { method: "PATCH", body: JSON.stringify({ unlocked: !m.unlocked }) });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't update this module");
    }
  }

  async function removeModule(m: TrainingModule) {
    if (!confirm(`Delete "${m.title}"? This removes all of its sessions too and can't be undone.`)) return;
    try {
      await api(`/api/admin/training/modules/${m.id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this module");
    }
  }

  async function removeSession(s: TrainingSession) {
    if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
    try {
      await api(`/api/admin/training/sessions/${s.id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this session");
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Training"
          subtitle="Manage program modules, sessions, and unlocking."
        />

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Trainers</h2>
          <button onClick={() => setEditingTrainer("new")} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add trainer</button>
        </div>

        {trainersLoading ? (
          <div className="mt-3"><SkeletonCards count={2} /></div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {trainers.length === 0 && (
              <p className="ost-card-subtext">No trainers yet. Add one, then assign them to a startup from that startup's detail page.</p>
            )}
            {trainers.map((t) => (
              <div key={t.id} className="ost-card flex items-start gap-3 p-5">
                {t.pictureUrl ? (
                  <img src={t.pictureUrl} alt={t.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary">{t.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {t.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {t.email}</span>}
                    {t.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {t.whatsapp}</span>}
                    {t.linkedinUrl && <span className="flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEditingTrainer(t)} className="ost-btn-ghost !p-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label={`Delete ${t.name}`} title="Delete" onClick={() => removeTrainer(t)} className="ost-btn-ghost !p-1.5 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Modules</h2>
          <button onClick={() => setEditingModule("new")} className="ost-btn-primary !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add module</button>
        </div>

        {isLoading ? (
          <div className="mt-3"><SkeletonCards count={3} /></div>
        ) : (
          <div className="mt-3 space-y-4">
            {modules.length === 0 && (
              <EmptyState icon={Layers} title="No modules yet" description="Add the first training module to get started." />
            )}
            {modules.map((m) => {
              const isOpen = expanded === m.id;
              return (
                <div key={m.id} className="ost-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button onClick={() => setExpanded(isOpen ? null : m.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.unlocked ? "bg-secondary/10 text-secondary" : "bg-slate-100 text-slate-400"}`}>
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary">Module {m.number} · {m.title}</p>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                        {m.description && <p className="mt-1 text-sm text-slate-500">{m.description}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {m.durationLabel && <span>{m.durationLabel}</span>}
                          <span>{m.sessions.length} session{m.sessions.length === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggleUnlock(m)}
                        className={`ost-btn-ghost !px-2.5 !py-1.5 text-xs ${m.unlocked ? "text-secondary" : ""}`}
                        title={m.unlocked ? "Lock this module" : "Unlock this module for everyone"}
                      >
                        {m.unlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {m.unlocked ? "Unlocked" : "Locked"}
                      </button>
                      <button aria-label={`Edit ${m.title}`} title="Edit" onClick={() => setEditingModule(m)} className="ost-btn-ghost !p-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button aria-label={`Delete ${m.title}`} title="Delete" onClick={() => removeModule(m)} className="ost-btn-ghost !p-1.5 text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Sessions</h4>
                        <button onClick={() => setEditingSession({ moduleId: m.id, session: null })} className="ost-btn-ghost !px-2.5 !py-1 text-xs">
                          <Plus className="h-3.5 w-3.5" /> Add session
                        </button>
                      </div>
                      {m.sessions.length === 0 ? (
                        <p className="ost-card-subtext">No sessions yet.</p>
                      ) : (
                        m.sessions.map((s) => (
                          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
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
                              <button aria-label={`Edit ${s.title}`} title="Edit" onClick={() => setEditingSession({ moduleId: m.id, session: s })} className="ost-btn-ghost !p-1.5">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button aria-label={`Delete ${s.title}`} title="Delete" onClick={() => removeSession(s)} className="ost-btn-ghost !p-1.5 text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editingModule && (
        <ModuleFormModal
          module={editingModule === "new" ? null : editingModule}
          nextNumber={modules.length + 1}
          onClose={() => setEditingModule(null)}
          onSaved={() => { invalidate(); setEditingModule(null); }}
        />
      )}

      {editingSession && (
        <SessionFormModal
          moduleId={editingSession.moduleId}
          session={editingSession.session}
          nextNumber={(modules.find((m) => m.id === editingSession.moduleId)?.sessions.length ?? 0) + 1}
          onClose={() => setEditingSession(null)}
          onSaved={() => { invalidate(); setEditingSession(null); }}
        />
      )}

      {editingTrainer && (
        <TrainerFormModal
          trainer={editingTrainer === "new" ? null : editingTrainer}
          onClose={() => setEditingTrainer(null)}
          onSaved={() => { invalidateTrainers(); setEditingTrainer(null); }}
        />
      )}
    </AppShell>
  );
}

function ModuleFormModal({
  module,
  nextNumber,
  onClose,
  onSaved,
}: {
  module: TrainingModule | null;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(String(module?.number ?? nextNumber));
  const [title, setTitle] = useState(module?.title ?? "");
  const [description, setDescription] = useState(module?.description ?? "");
  const [durationLabel, setDurationLabel] = useState(module?.durationLabel ?? "");
  const [unlocked, setUnlocked] = useState(module?.unlocked ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ number: Number(number) || 1, title, description, durationLabel, unlocked });
      if (module) {
        await api(`/api/admin/training/modules/${module.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/training/modules", { method: "POST", body });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg" scrollable={false}>
      <h3 className="mb-4 text-lg font-bold text-primary">{module ? "Edit module" : "Add module"}</h3>

      <label className="ost-label">Module number</label>
      <input type="number" min={1} className="ost-input mb-3" value={number} onChange={(e) => setNumber(e.target.value)} />

      <label className="ost-label">Title</label>
      <input className="ost-input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diagnostic & Strategic Foundations" />

      <label className="ost-label">Description (optional)</label>
      <textarea className="ost-input mb-3 min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />

      <label className="ost-label">Duration label (optional)</label>
      <input className="ost-input mb-3" value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="e.g. 4 weeks" />

      <label className="flex items-center gap-2 text-sm font-medium text-primary">
        <input type="checkbox" checked={unlocked} onChange={(e) => setUnlocked(e.target.checked)} />
        Unlocked for every startup
      </label>

      {error && <p className="mb-3 mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!title.trim() || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {module ? "Save changes" : "Add module"}
        </button>
      </div>
    </ModalShell>
  );
}

function SessionFormModal({
  moduleId,
  session,
  nextNumber,
  onClose,
  onSaved,
}: {
  moduleId: string;
  session: TrainingSession | null;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(String(session?.number ?? nextNumber));
  const [title, setTitle] = useState(session?.title ?? "");
  const [description, setDescription] = useState(session?.description ?? "");
  const [scheduledAt, setScheduledAt] = useState(session ? toDatetimeLocal(new Date(session.scheduledAt)) : "");
  const [durationMinutes, setDurationMinutes] = useState(String(session?.durationMinutes ?? 120));
  const [experts, setExperts] = useState(session?.experts ?? "");
  const [trainerBio, setTrainerBio] = useState(session?.trainerBio ?? "");
  const [status, setStatus] = useState<"upcoming" | "completed">(session?.status ?? "upcoming");
  const [meetingLink, setMeetingLink] = useState(session?.meetingLink ?? "");
  const [presentationUrl, setPresentationUrl] = useState(session?.presentationUrl ?? "");
  const [recordingUrl, setRecordingUrl] = useState(session?.recordingUrl ?? "");
  const [transcriptUrl, setTranscriptUrl] = useState(session?.transcriptUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        moduleId,
        number: Number(number) || 1,
        title,
        description,
        scheduledAt,
        durationMinutes: Number(durationMinutes) || 120,
        experts,
        trainerBio,
        status,
        meetingLink,
        presentationUrl,
        recordingUrl,
        transcriptUrl,
      });
      if (session) {
        await api(`/api/admin/training/sessions/${session.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/training/sessions", { method: "POST", body });
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

      <label className="ost-label mt-3">Expert(s)</label>
      <input className="ost-input mb-3" value={experts} onChange={(e) => setExperts(e.target.value)} placeholder="e.g. Ivy Shultz & Farzin Samadani" />

      <label className="ost-label">Trainer bio (optional, shown to founders)</label>
      <textarea className="ost-input mb-3 min-h-[50px]" value={trainerBio} onChange={(e) => setTrainerBio(e.target.value)} placeholder="Short bio describing the trainer's background" />

      <label className="ost-label">Meeting link (for upcoming sessions)</label>
      <input className="ost-input mb-3" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Presentation link</label>
      <input className="ost-input mb-3" value={presentationUrl} onChange={(e) => setPresentationUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Recording link</label>
      <input className="ost-input mb-3" value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Transcript link</label>
      <input className="ost-input mb-3" value={transcriptUrl} onChange={(e) => setTranscriptUrl(e.target.value)} placeholder="https://…" />

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

function TrainerFormModal({
  trainer,
  onClose,
  onSaved,
}: {
  trainer: Trainer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(trainer?.name ?? "");
  const [introduction, setIntroduction] = useState(trainer?.introduction ?? "");
  const [email, setEmail] = useState(trainer?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(trainer?.whatsapp ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(trainer?.linkedinUrl ?? "");
  const [picture, setPicture] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadPicture(trainerId: string) {
    if (!picture) return;
    const form = new FormData();
    form.append("picture", picture);
    const res = await fetch(`/api/admin/trainers/${trainerId}/picture`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || "Picture upload failed");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ name, introduction, email, whatsapp, linkedinUrl });
      let id = trainer?.id;
      if (trainer) {
        await api(`/api/admin/trainers/${trainer.id}`, { method: "PATCH", body });
      } else {
        const created = await api<Trainer>("/api/admin/trainers", { method: "POST", body });
        id = created.id;
      }
      if (id) await uploadPicture(id);
      onSaved();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-primary">{trainer ? "Edit trainer" : "Add trainer"}</h3>

      <div className="mb-4 flex items-center gap-3">
        {picture ? (
          <img src={URL.createObjectURL(picture)} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : trainer?.pictureUrl ? (
          <img src={trainer.pictureUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <User className="h-6 w-6" />
          </div>
        )}
        <label className="ost-btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
          <Camera className="h-3.5 w-3.5" /> {trainer?.pictureUrl || picture ? "Change picture" : "Add picture"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <label className="ost-label">Name</label>
      <input className="ost-input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ivy Shultz" />

      <label className="ost-label">Introduction (optional)</label>
      <textarea className="ost-input mb-3 min-h-[70px]" value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="A short intro shown to their assigned startups" />

      <label className="ost-label">Email</label>
      <input type="email" className="ost-input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainer@example.com" />

      <label className="ost-label">WhatsApp number</label>
      <input className="ost-input mb-3" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="e.g. +216 12 345 678" />

      <label className="ost-label">LinkedIn link</label>
      <input className="ost-input mb-3" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!name.trim() || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {trainer ? "Save changes" : "Add trainer"}
        </button>
      </div>
    </ModalShell>
  );
}
