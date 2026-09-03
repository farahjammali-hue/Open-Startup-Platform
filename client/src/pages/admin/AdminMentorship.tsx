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
  CalendarClock, Pencil, Trash2, Plus, Loader2, User, Mail, MessageCircle, Linkedin, Camera, Users,
} from "lucide-react";

interface Mentor {
  id: string;
  name: string;
  introduction: string | null;
  pictureUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

interface Expert {
  id: string;
  name: string;
  bio: string | null;
  industries: string[] | null;
  expertiseAreas: string[] | null;
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
}

/** datetime-local expects local time, no timezone suffix. */
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminMentorship() {
  const qc = useQueryClient();
  const [editingSession, setEditingSession] = useState<MentorshipSession | "new" | null>(null);
  const [editingMentor, setEditingMentor] = useState<Mentor | "new" | null>(null);
  const [editingExpert, setEditingExpert] = useState<Expert | "new" | null>(null);

  const { data, isLoading } = useQuery<{ sessions: MentorshipSession[] }>({
    queryKey: ["admin-mentorship"],
    queryFn: () => api("/api/admin/mentorship/sessions"),
  });
  const sessions = data?.sessions ?? [];

  const { data: mentorsData, isLoading: mentorsLoading } = useQuery<{ mentors: Mentor[] }>({
    queryKey: ["admin-mentors"],
    queryFn: () => api("/api/admin/mentors"),
  });
  const mentors = mentorsData?.mentors ?? [];

  const { data: expertsData, isLoading: expertsLoading } = useQuery<{ experts: Expert[] }>({
    queryKey: ["admin-experts"],
    queryFn: () => api("/api/admin/experts"),
  });
  const experts = expertsData?.experts ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-mentorship"] });
  }

  function invalidateMentors() {
    qc.invalidateQueries({ queryKey: ["admin-mentors"] });
  }

  function invalidateExperts() {
    qc.invalidateQueries({ queryKey: ["admin-experts"] });
  }

  async function removeMentor(m: Mentor) {
    if (!confirm(`Delete "${m.name}"? Any startup they're assigned to will be unassigned.`)) return;
    try {
      await api(`/api/admin/mentors/${m.id}`, { method: "DELETE" });
      invalidateMentors();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this mentor");
    }
  }

  async function removeSession(s: MentorshipSession) {
    if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
    try {
      await api(`/api/admin/mentorship/sessions/${s.id}`, { method: "DELETE" });
      invalidate();
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this session");
    }
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

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Mentorship"
          subtitle="Manage mentors and sessions."
        />

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Mentors</h2>
          <button onClick={() => setEditingMentor("new")} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add mentor</button>
        </div>

        {mentorsLoading ? (
          <div className="mt-3"><SkeletonCards count={2} /></div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mentors.length === 0 && (
              <p className="ost-card-subtext">No mentors yet. Add one, then assign them to a startup from that startup's detail page.</p>
            )}
            {mentors.map((m) => (
              <div key={m.id} className="ost-card flex items-start gap-3 p-5">
                {m.pictureUrl ? (
                  <img src={m.pictureUrl} alt={m.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary">{m.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {m.email}</span>}
                    {m.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {m.whatsapp}</span>}
                    {m.linkedinUrl && <span className="flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label={`Edit ${m.name}`} title="Edit" onClick={() => setEditingMentor(m)} className="ost-btn-ghost !p-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label={`Delete ${m.name}`} title="Delete" onClick={() => removeMentor(m)} className="ost-btn-ghost !p-1.5 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Sessions</h2>
          <button onClick={() => setEditingSession("new")} className="ost-btn-primary !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add session</button>
        </div>

        {isLoading ? (
          <div className="mt-3"><SkeletonCards count={3} /></div>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.length === 0 && (
              <EmptyState icon={CalendarClock} title="No sessions yet" description="Add the first mentorship session to get started." />
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

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Other experts</h2>
          <button onClick={() => setEditingExpert("new")} className="ost-btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add expert</button>
        </div>

        {expertsLoading ? (
          <div className="mt-3"><SkeletonCards count={2} /></div>
        ) : (
          <div className="mt-3 space-y-2">
            {experts.length === 0 && (
              <EmptyState icon={Users} title="No experts yet" description="Add the first expert to the browsable catalog." />
            )}
            {experts.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">{e.name}</p>
                  {e.bio && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{e.bio}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {(e.industries ?? []).map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">{tag}</span>
                    ))}
                    {(e.expertiseAreas ?? []).map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label={`Edit ${e.name}`} title="Edit" onClick={() => setEditingExpert(e)} className="ost-btn-ghost !p-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label={`Delete ${e.name}`} title="Delete" onClick={() => removeExpert(e)} className="ost-btn-ghost !p-1.5 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          session={editingSession === "new" ? null : editingSession}
          nextNumber={sessions.length + 1}
          onClose={() => setEditingSession(null)}
          onSaved={() => { invalidate(); setEditingSession(null); }}
        />
      )}

      {editingMentor && (
        <MentorFormModal
          mentor={editingMentor === "new" ? null : editingMentor}
          onClose={() => setEditingMentor(null)}
          onSaved={() => { invalidateMentors(); setEditingMentor(null); }}
        />
      )}
    </AppShell>
  );
}

function SessionFormModal({
  session,
  nextNumber,
  onClose,
  onSaved,
}: {
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
  const [experts, setExperts] = useState(session?.experts ?? "");
  const [mentorBio, setMentorBio] = useState(session?.mentorBio ?? "");
  const [status, setStatus] = useState<"upcoming" | "completed">(session?.status ?? "upcoming");
  const [meetingLink, setMeetingLink] = useState(session?.meetingLink ?? "");
  const [recordingUrl, setRecordingUrl] = useState(session?.recordingUrl ?? "");
  const [transcriptUrl, setTranscriptUrl] = useState(session?.transcriptUrl ?? "");
  const [materialsUrl, setMaterialsUrl] = useState(session?.materialsUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        experts,
        mentorBio,
        status,
        meetingLink,
        recordingUrl,
        transcriptUrl,
        materialsUrl,
      });
      if (session) {
        await api(`/api/admin/mentorship/sessions/${session.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/mentorship/sessions", { method: "POST", body });
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

      <label className="ost-label">Mentor bio (optional, shown to founders)</label>
      <textarea className="ost-input mb-3 min-h-[50px]" value={mentorBio} onChange={(e) => setMentorBio(e.target.value)} placeholder="Short bio describing the mentor's background" />

      <label className="ost-label">Meeting link (for upcoming sessions)</label>
      <input className="ost-input mb-3" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Recording link</label>
      <input className="ost-input mb-3" value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Transcript link</label>
      <input className="ost-input mb-3" value={transcriptUrl} onChange={(e) => setTranscriptUrl(e.target.value)} placeholder="https://…" />

      <label className="ost-label">Materials link</label>
      <input className="ost-input mb-3" value={materialsUrl} onChange={(e) => setMaterialsUrl(e.target.value)} placeholder="https://…" />

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

function MentorFormModal({
  mentor,
  onClose,
  onSaved,
}: {
  mentor: Mentor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(mentor?.name ?? "");
  const [introduction, setIntroduction] = useState(mentor?.introduction ?? "");
  const [email, setEmail] = useState(mentor?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(mentor?.whatsapp ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(mentor?.linkedinUrl ?? "");
  const [picture, setPicture] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadPicture(mentorId: string) {
    if (!picture) return;
    const form = new FormData();
    form.append("picture", picture);
    const res = await fetch(`/api/admin/mentors/${mentorId}/picture`, { method: "POST", credentials: "include", body: form });
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
      let id = mentor?.id;
      if (mentor) {
        await api(`/api/admin/mentors/${mentor.id}`, { method: "PATCH", body });
      } else {
        const created = await api<Mentor>("/api/admin/mentors", { method: "POST", body });
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
      <h3 className="mb-4 text-lg font-bold text-primary">{mentor ? "Edit mentor" : "Add mentor"}</h3>

      <div className="mb-4 flex items-center gap-3">
        {picture ? (
          <img src={URL.createObjectURL(picture)} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : mentor?.pictureUrl ? (
          <img src={mentor.pictureUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <User className="h-6 w-6" />
          </div>
        )}
        <label className="ost-btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
          <Camera className="h-3.5 w-3.5" /> {mentor?.pictureUrl || picture ? "Change picture" : "Add picture"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPicture(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <label className="ost-label">Name</label>
      <input className="ost-input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ivy Shultz" />

      <label className="ost-label">Introduction (optional)</label>
      <textarea className="ost-input mb-3 min-h-[70px]" value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="A short intro shown to their assigned startups" />

      <label className="ost-label">Email</label>
      <input type="email" className="ost-input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mentor@example.com" />

      <label className="ost-label">WhatsApp number</label>
      <input className="ost-input mb-3" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="e.g. +216 12 345 678" />

      <label className="ost-label">LinkedIn link</label>
      <input className="ost-input mb-3" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={!name.trim() || saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {mentor ? "Save changes" : "Add mentor"}
        </button>
      </div>
    </ModalShell>
  );
}

function splitTags(v: string): string[] {
  return v.split(",").map((t) => t.trim()).filter(Boolean);
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
