import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { ModalShell } from "../../components/ModalShell";
import { showToast } from "../../lib/toast";
import {
  GOAL_STATUS_LABELS, GOAL_STATUS_TONES, MONTHLY_STATUS_LABELS, MONTHLY_STATUS_TONES, MONTH_NAMES,
  type Goal, type KpiSubmission, type MonthlyUpdateRow, type TeamMemberRow,
} from "../dashboard/types";
import { KPI_PHASE_LABELS } from "../../lib/kpiPhases";
import { STAGE_LABELS, type StartupStage } from "../../lib/stageLabels";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS } from "../../lib/statusTones";
import { formatMoney } from "../../lib/format";
import {
  Building2, Globe, MapPin, Users, Target, LineChart, CalendarClock, FolderLock,
  FileSignature, ShieldCheck, ExternalLink, Inbox, Layers, Pencil, Loader2, Paperclip, User, Mail, MessageCircle, Linkedin, Presentation,
} from "lucide-react";

interface ReviewEntity { status: "pending" | "approved" | "rejected"; reviewNote: string | null }

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

interface Mentor {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
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

interface TrainingModuleHomeworkRow {
  moduleId: string;
  homeworkUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
}

interface Trainer {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

interface Detail {
  startup: {
    id: string; companyName: string; website: string | null; location: string | null;
    stage: string | null; logoUrl: string | null; isIncorporated: boolean | null; graduatedAt: string | null;
    dataRoomLink: string | null; dataRoomUpdatedAt: string | null; mentorId: string | null; trainerId: string | null;
  };
  owner: { name: string; email: string } | null;
  goals: Goal[];
  kpiSubmissions: KpiSubmission[];
  monthlyUpdates: MonthlyUpdateRow[];
  teamMembers: TeamMemberRow[];
  contract: (ReviewEntity & { signerName: string; signedAt: string }) | null;
  kysProfile: (ReviewEntity & { track: string; submittedAt: string }) | null;
  mentorshipNotes: MentorshipSessionNoteRow[];
  trainingNotes: TrainingSessionNoteRow[];
  trainingHomework: TrainingModuleHomeworkRow[];
}

interface MentorshipSessionRow {
  id: string;
  number: number;
  title: string;
  scheduledAt: string;
  status: "upcoming" | "completed";
}

interface TrainingModuleWithSessions {
  id: string;
  number: number;
  title: string;
  sessions: { id: string; number: number; title: string; scheduledAt: string; status: "upcoming" | "completed" }[];
}

export default function AdminStartupDetail() {
  const [, params] = useRoute("/admin/startups/:id");
  const id = params?.id ?? "";
  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["admin-startup-detail", id],
    queryFn: () => api(`/api/admin/startups/${id}`),
    enabled: !!id,
  });
  const { data: mentorshipData } = useQuery<{ sessions: MentorshipSessionRow[] }>({
    queryKey: ["admin-mentorship"],
    queryFn: () => api("/api/admin/mentorship/sessions"),
    enabled: !!id,
  });
  const { data: mentorsData } = useQuery<{ mentors: Mentor[] }>({
    queryKey: ["admin-mentors"],
    queryFn: () => api("/api/admin/mentors"),
    enabled: !!id,
  });
  const { data: trainingData } = useQuery<{ modules: TrainingModuleWithSessions[] }>({
    queryKey: ["admin-training-modules"],
    queryFn: () => api("/api/admin/training/modules"),
    enabled: !!id,
  });
  const { data: trainersData } = useQuery<{ trainers: Trainer[] }>({
    queryKey: ["admin-trainers"],
    queryFn: () => api("/api/admin/trainers"),
    enabled: !!id,
  });
  const [notesModalSession, setNotesModalSession] = useState<{
    sessionId: string;
    sessionNumber: number;
    sessionTitle: string;
  } | null>(null);
  const [trainingNotesModalSession, setTrainingNotesModalSession] = useState<{
    sessionId: string;
    moduleNumber: number;
    moduleTitle: string;
    sessionNumber: number;
    sessionTitle: string;
  } | null>(null);
  const [trainingHomeworkModalModule, setTrainingHomeworkModalModule] = useState<{ moduleId: string; moduleNumber: number; moduleTitle: string } | null>(null);

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/startups" label="Back to All startups" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton tone="dark" className="h-32 rounded-2xl" />
            <Skeleton tone="dark" className="h-32 rounded-2xl" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup, owner, goals, kpiSubmissions, monthlyUpdates, teamMembers, contract, kysProfile, mentorshipNotes, trainingNotes, trainingHomework } = data;

  const notesBySessionId = new Map(mentorshipNotes.map((n) => [n.sessionId, n]));
  const mentorshipSessions = (mentorshipData?.sessions ?? [])
    .map((s) => ({
      sessionId: s.id,
      sessionNumber: s.number,
      sessionTitle: s.title,
      scheduledAt: s.scheduledAt,
      status: s.status,
      notes: notesBySessionId.get(s.id) ?? null,
    }))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));

  const trainingNotesBySessionId = new Map(trainingNotes.map((n) => [n.sessionId, n]));
  const trainingHomeworkByModuleId = new Map(trainingHomework.map((h) => [h.moduleId, h]));
  const trainingModulesList = trainingData?.modules ?? [];
  const trainingSessions = trainingModulesList
    .flatMap((m) => m.sessions.map((s) => ({
      sessionId: s.id,
      moduleNumber: m.number,
      moduleTitle: m.title,
      sessionNumber: s.number,
      sessionTitle: s.title,
      scheduledAt: s.scheduledAt,
      status: s.status,
      notes: trainingNotesBySessionId.get(s.id) ?? null,
    })))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/startups" label="Back to All startups" />
        <PageHeader
          eyebrow="Administration"
          title={
            <span className="flex items-center gap-3">
              {startup.logoUrl ? (
                <img src={startup.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <Building2 className="h-6 w-6 text-secondary" />
              )}
              {startup.companyName}
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-4 text-sm">
              {owner && <span>{owner.name} · {owner.email}</span>}
              {startup.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {startup.location}</span>}
              {startup.website && (
                <a href={startup.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-secondary hover:underline">
                  <Globe className="h-3.5 w-3.5" /> {startup.website}
                </a>
              )}
              {startup.stage && <span>{STAGE_LABELS[startup.stage as StartupStage] || startup.stage}</span>}
            </span>
          }
        />

        {/* Contract & KYS */}
        <Section title="Contract & KYS" icon={FileSignature}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReviewCard icon={FileSignature} label="Contract" entity={contract} detail={contract ? `Signed by ${contract.signerName}` : "Not signed yet"} />
            <ReviewCard icon={ShieldCheck} label="KYS profile" entity={kysProfile} detail={kysProfile ? `Track: ${kysProfile.track}` : "Not submitted yet"} />
          </div>
        </Section>

        {/* Objectives */}
        <Section title="Objectives" icon={Target}>
          {goals.length === 0 ? <EmptyRow text="No objectives set yet." /> : (
            <div className="space-y-2">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-primary">{g.title}</div>
                    {g.targetDate && <div className="text-xs text-slate-400">Target: {new Date(g.targetDate).toLocaleDateString()}</div>}
                  </div>
                  <StatusBadge tone={GOAL_STATUS_TONES[g.status]}>{GOAL_STATUS_LABELS[g.status]}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* KPI submissions */}
        <Section title="KPI submissions" icon={LineChart}>
          {kpiSubmissions.length === 0 ? <EmptyRow text="No KPI data submitted yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Phase</th>
                    <th className="py-2 pr-4 font-semibold">Revenue</th>
                    <th className="py-2 pr-4 font-semibold">Active users</th>
                    <th className="py-2 pr-4 font-semibold">Burn rate</th>
                    <th className="py-2 pr-4 font-semibold">Cash on hand</th>
                    <th className="py-2 pr-4 font-semibold">Team size</th>
                    <th className="py-2 pr-4 font-semibold">Runway (mo)</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiSubmissions.map((k) => (
                    <tr key={k.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-4 font-semibold text-primary">{KPI_PHASE_LABELS[k.phase] || k.phase}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(k.revenue)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{k.activeUsers ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(k.burnRate)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{formatMoney(k.cashOnHand)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{k.teamSize ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-500">{k.runwayMonths ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Monthly updates */}
        <Section title="Monthly updates" icon={CalendarClock}>
          {monthlyUpdates.length === 0 ? <EmptyRow text="No monthly updates submitted yet." /> : (
            <div className="space-y-3">
              {monthlyUpdates.map((u) => (
                <div key={u.id} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{MONTH_NAMES[u.periodMonth - 1]} {u.periodYear}</span>
                    <StatusBadge tone={MONTHLY_STATUS_TONES[u.status]}>{MONTHLY_STATUS_LABELS[u.status]}</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-500"><b className="text-slate-600">Achieved:</b> {u.achieved}</p>
                  <p className="mt-1 text-xs text-slate-500"><b className="text-slate-600">Blocked:</b> {u.blocked}</p>
                  <p className="mt-1 text-xs text-slate-500"><b className="text-slate-600">Focus next:</b> {u.focusNext}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Team */}
        <Section title="Team" icon={Users}>
          {teamMembers.length === 0 ? <EmptyRow text="No team members added yet." /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {teamMembers.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-primary">{m.name}</div>
                  <div className="text-xs text-slate-400">{m.role || "—"} · {m.type.replace("_", " ")}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Data Room */}
        <Section title="Data room" icon={FolderLock}>
          {startup.dataRoomLink ? (
            <>
              <a href={startup.dataRoomLink} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 hover:border-secondary">
                <span className="truncate text-sm font-semibold text-primary">{startup.dataRoomLink}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
              <p className="mt-2 text-xs text-slate-400">
                {startup.dataRoomUpdatedAt
                  ? `Startup marked this updated on ${new Date(startup.dataRoomUpdatedAt).toLocaleString()}`
                  : "The startup hasn't marked this as updated since submitting the link."}
              </p>
            </>
          ) : (
            <EmptyRow text="No data room link submitted yet." />
          )}
        </Section>

        {/* Mentor */}
        <Section title="Mentor" icon={User}>
          <MentorAssignment startupId={startup.id} currentMentorId={startup.mentorId} mentors={mentorsData?.mentors ?? []} />
        </Section>

        {/* Mentorship */}
        <Section title="Mentorship" icon={Layers}>
          {mentorshipSessions.length === 0 ? <EmptyRow text="No mentorship sessions yet." /> : (
            <div className="space-y-2">
              {mentorshipSessions.map((s) => {
                const hasRecap = Boolean(
                  s.notes && (s.notes.pointsDiscussed || s.notes.whatIsGoingWell || s.notes.whatIsNotGoingWell || s.notes.actionItems || s.notes.teamMembersPresence),
                );
                const hasFeedback = Boolean(s.notes && (s.notes.mentorRating || s.notes.mentorFeedback));
                return (
                  <div key={s.sessionId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-primary">Session {s.sessionNumber} — {s.sessionTitle}</div>
                      <div className="text-xs text-slate-400">{new Date(s.scheduledAt).toLocaleString()}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={hasRecap ? "teal" : "gray"}>{hasRecap ? "Recap submitted" : "No recap yet"}</StatusBadge>
                      <StatusBadge tone={hasFeedback ? "teal" : "gray"}>{hasFeedback ? "Feedback added" : "No feedback yet"}</StatusBadge>
                      <button
                        onClick={() => setNotesModalSession({ sessionId: s.sessionId, sessionNumber: s.sessionNumber, sessionTitle: s.sessionTitle })}
                        className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit feedback
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Trainer */}
        <Section title="Trainer" icon={User}>
          <TrainerAssignment startupId={startup.id} currentTrainerId={startup.trainerId} trainers={trainersData?.trainers ?? []} />
        </Section>

        {/* Training */}
        <Section title="Training" icon={Presentation}>
          {trainingSessions.length === 0 ? <EmptyRow text="No training sessions yet." /> : (
            <div className="space-y-2">
              {trainingSessions.map((s) => {
                const hasRecap = Boolean(
                  s.notes && (s.notes.pointsDiscussed || s.notes.whatIsGoingWell || s.notes.whatIsNotGoingWell || s.notes.actionItems || s.notes.teamMembersPresence),
                );
                const hasFeedback = Boolean(s.notes && (s.notes.trainerRating || s.notes.trainerFeedback));
                return (
                  <div key={s.sessionId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-primary">Module {s.moduleNumber} · Session {s.sessionNumber} — {s.sessionTitle}</div>
                      <div className="text-xs text-slate-400">{new Date(s.scheduledAt).toLocaleString()}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={hasRecap ? "teal" : "gray"}>{hasRecap ? "Recap submitted" : "No recap yet"}</StatusBadge>
                      <StatusBadge tone={hasFeedback ? "teal" : "gray"}>{hasFeedback ? "Feedback added" : "No feedback yet"}</StatusBadge>
                      <button
                        onClick={() => setTrainingNotesModalSession({ sessionId: s.sessionId, moduleNumber: s.moduleNumber, moduleTitle: s.moduleTitle, sessionNumber: s.sessionNumber, sessionTitle: s.sessionTitle })}
                        className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit feedback
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Training homework — per module, not per session */}
        <Section title="Training homework" icon={Paperclip}>
          {trainingModulesList.length === 0 ? <EmptyRow text="No training modules yet." /> : (
            <div className="space-y-2">
              {trainingModulesList.map((m) => {
                const h = trainingHomeworkByModuleId.get(m.id) ?? null;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
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
                        onClick={() => setTrainingHomeworkModalModule({ moduleId: m.id, moduleNumber: m.number, moduleTitle: m.title })}
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
        </Section>
      </main>

      {notesModalSession && (
        <SessionNotesModal
          startupId={startup.id}
          sessionId={notesModalSession.sessionId}
          title={`Session ${notesModalSession.sessionNumber} — ${notesModalSession.sessionTitle}`}
          notes={notesBySessionId.get(notesModalSession.sessionId) ?? null}
          onClose={() => setNotesModalSession(null)}
        />
      )}

      {trainingNotesModalSession && (
        <TrainingSessionNotesModal
          startupId={startup.id}
          sessionId={trainingNotesModalSession.sessionId}
          title={`Module ${trainingNotesModalSession.moduleNumber} · Session ${trainingNotesModalSession.sessionNumber} — ${trainingNotesModalSession.sessionTitle}`}
          notes={trainingNotesBySessionId.get(trainingNotesModalSession.sessionId) ?? null}
          onClose={() => setTrainingNotesModalSession(null)}
        />
      )}

      {trainingHomeworkModalModule && (
        <TrainingModuleHomeworkModal
          startupId={startup.id}
          moduleId={trainingHomeworkModalModule.moduleId}
          title={`Module ${trainingHomeworkModalModule.moduleNumber} · ${trainingHomeworkModalModule.moduleTitle}`}
          homework={trainingHomeworkByModuleId.get(trainingHomeworkModalModule.moduleId) ?? null}
          onClose={() => setTrainingHomeworkModalModule(null)}
        />
      )}
    </AppShell>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="ost-card mt-8 p-6">
      <h2 className="ost-card-title mb-4 flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-secondary" /> {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
      <Inbox className="h-4 w-4" /> {text}
    </div>
  );
}

function MentorAssignment({
  startupId,
  currentMentorId,
  mentors,
}: {
  startupId: string;
  currentMentorId: string | null;
  mentors: Mentor[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(currentMentorId ?? "");
  const [saving, setSaving] = useState(false);

  const current = mentors.find((m) => m.id === currentMentorId) ?? null;

  async function assign() {
    setSaving(true);
    try {
      await api(`/api/admin/startups/${startupId}/mentor`, {
        method: "PATCH",
        body: JSON.stringify({ mentorId: selected || null }),
      });
      qc.invalidateQueries({ queryKey: ["admin-startup-detail", startupId] });
      showToast(selected ? "Mentor assigned" : "Mentor unassigned");
    } catch (e: any) {
      showToast(e.message || "Couldn't update the mentor assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {current && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{current.name}</span>
          {current.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="h-3 w-3" /> {current.email}</span>}
          {current.whatsapp && <span className="flex items-center gap-1 text-xs text-slate-400"><MessageCircle className="h-3 w-3" /> {current.whatsapp}</span>}
          {current.linkedinUrl && (
            <a href={current.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
              <Linkedin className="h-3 w-3" /> LinkedIn
            </a>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ost-input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">No mentor assigned</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={saving || selected === (currentMentorId ?? "")}
          className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
      {mentors.length === 0 && <p className="text-xs text-slate-400">No mentors in the directory yet, add one from the Mentorship admin page.</p>}
    </div>
  );
}

function TrainerAssignment({
  startupId,
  currentTrainerId,
  trainers,
}: {
  startupId: string;
  currentTrainerId: string | null;
  trainers: Trainer[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(currentTrainerId ?? "");
  const [saving, setSaving] = useState(false);

  const current = trainers.find((t) => t.id === currentTrainerId) ?? null;

  async function assign() {
    setSaving(true);
    try {
      await api(`/api/admin/startups/${startupId}/trainer`, {
        method: "PATCH",
        body: JSON.stringify({ trainerId: selected || null }),
      });
      qc.invalidateQueries({ queryKey: ["admin-startup-detail", startupId] });
      showToast(selected ? "Trainer assigned" : "Trainer unassigned");
    } catch (e: any) {
      showToast(e.message || "Couldn't update the trainer assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {current && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{current.name}</span>
          {current.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="h-3 w-3" /> {current.email}</span>}
          {current.whatsapp && <span className="flex items-center gap-1 text-xs text-slate-400"><MessageCircle className="h-3 w-3" /> {current.whatsapp}</span>}
          {current.linkedinUrl && (
            <a href={current.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
              <Linkedin className="h-3 w-3" /> LinkedIn
            </a>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ost-input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">No trainer assigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={saving || selected === (currentTrainerId ?? "")}
          className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
      {trainers.length === 0 && <p className="text-xs text-slate-400">No trainers in the directory yet, add one from the Training admin page.</p>}
    </div>
  );
}

function ReviewCard({
  icon: Icon,
  label,
  entity,
  detail,
}: {
  icon: any;
  label: string;
  entity: ReviewEntity | null;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Icon className="h-3.5 w-3.5" /> {label}</span>
        {entity ? (
          <StatusBadge tone={REVIEW_STATUS_TONES[entity.status]} icon={REVIEW_STATUS_ICONS[entity.status]}>{entity.status}</StatusBadge>
        ) : (
          <StatusBadge tone="gray">Not started</StatusBadge>
        )}
      </div>
      <p className="text-xs text-slate-500">{detail}</p>
      {entity?.reviewNote && <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">“{entity.reviewNote}”</p>}
    </div>
  );
}

function SessionNotesModal({
  startupId,
  sessionId,
  title,
  notes,
  onClose,
}: {
  startupId: string;
  sessionId: string;
  title: string;
  notes: MentorshipSessionNoteRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ["admin-startup-detail", startupId] });
      showToast("Feedback saved");
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

function TrainingSessionNotesModal({
  startupId,
  sessionId,
  title,
  notes,
  onClose,
}: {
  startupId: string;
  sessionId: string;
  title: string;
  notes: TrainingSessionNoteRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ["admin-startup-detail", startupId] });
      showToast("Feedback saved");
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

function TrainingModuleHomeworkModal({
  startupId,
  moduleId,
  title,
  homework,
  onClose,
}: {
  startupId: string;
  moduleId: string;
  title: string;
  homework: TrainingModuleHomeworkRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [homeworkUrl, setHomeworkUrl] = useState(homework?.homeworkUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/startups/${startupId}/training-homework/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ homeworkUrl }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-startup-detail", startupId] });
      showToast("Homework assignment saved");
      onClose();
    } catch (e: any) {
      setError(e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell maxWidth="max-w-md">
      <h3 className="mb-4 text-lg font-bold text-primary">{title}</h3>

      <label className="ost-label">Homework assignment (link)</label>
      <input className="ost-input mb-3" value={homeworkUrl} onChange={(e) => setHomeworkUrl(e.target.value)} placeholder="https://…" />

      {homework?.submissionFileUrl && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Startup submitted: <a href={homework.submissionFileUrl} target="_blank" rel="noreferrer" className="font-semibold text-secondary hover:underline">
            {homework.submissionFileName ?? "file"}
          </a>
        </p>
      )}

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="ost-btn-ghost">Cancel</button>
        <button disabled={saving} onClick={save} className="ost-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save homework
        </button>
      </div>
    </ModalShell>
  );
}
