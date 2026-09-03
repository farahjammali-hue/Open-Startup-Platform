import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ModalShell } from "../components/ModalShell";
import { StatusBadge, type StatusTone } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { useKysStatus } from "../lib/kysStatus";
import { showToast } from "../lib/toast";
import { MENTORSHIP_SESSION_STATUS_TONES, MENTORSHIP_SESSION_STATUS_ICONS } from "../lib/statusTones";
import {
  Layers, Lock, ChevronRight, ChevronLeft, Presentation, Video, FileText, Link2,
  CalendarClock, Clock, Loader2, User, MessageCircle, Mail, Linkedin,
} from "lucide-react";

interface TrainerProfile {
  id: string;
  name: string;
  introduction: string | null;
  pictureUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedinUrl: string | null;
}

interface TrainingSessionNotes {
  teamMembersPresence: string | null;
  pointsDiscussed: string | null;
  whatIsGoingWell: string | null;
  whatIsNotGoingWell: string | null;
  actionItems: string | null;
  trainerRating: number | null;
  trainerFeedback: string | null;
}

interface TrainingModuleHomeworkData {
  homeworkUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
}

interface TrainingSession {
  id: string;
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
  notes: TrainingSessionNotes;
}

type ModuleStatus = "locked" | "upcoming" | "active" | "completed";

interface TrainingModuleData {
  id: string;
  number: number;
  title: string;
  description: string | null;
  durationLabel: string | null;
  unlocked: boolean;
  sessions: TrainingSession[];
  status: ModuleStatus;
  completedSessionsCount: number;
  totalSessionsCount: number;
  homework: TrainingModuleHomeworkData;
}

const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = { locked: "Locked", upcoming: "Upcoming", active: "Active", completed: "Completed" };
const MODULE_STATUS_TONES: Record<ModuleStatus, StatusTone> = { locked: "gray", upcoming: "amber", active: "teal", completed: "primary" };

const TABS = ["trainer", "modules", "sessionDetails"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  trainer: "Trainer",
  modules: "Program modules",
  sessionDetails: "Session details",
};

function googleCalendarLink(title: string, scheduledAt: string, durationMinutes: number) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export default function Training() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { kysSubmitted, isLoading: kysLoading } = useKysStatus();
  const [tab, setTab] = useState<Tab>("trainer");
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<TrainingSession | null>(null);

  const { data, isLoading } = useQuery<{ modules: TrainingModuleData[]; trainer: TrainerProfile | null }>({
    queryKey: ["training"],
    queryFn: () => api("/api/training"),
    enabled: kysSubmitted,
  });

  const modules = data?.modules ?? [];
  const trainer = data?.trainer ?? null;

  useEffect(() => {
    const params = new URLSearchParams(search);
    const moduleParam = params.get("module");
    if (moduleParam) {
      setTab("modules");
      setOpenModuleId(moduleParam);
    }
  }, [search]);

  if (kysLoading) return null;

  if (!kysSubmitted) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink />
          <PageHeader eyebrow="Program tools" title="Training" subtitle="Program modules and sessions, unlocked as you progress." />
          <div className="mt-8">
            <EmptyState
              icon={Lock}
              title="Complete your KYC to unlock training"
              description="Finish your Contract & KYS submission to access modules and sessions."
              actionLabel="Go to Contract & KYS"
              onAction={() => navigate("/contract-kys")}
            />
          </div>
        </main>
      </AppShell>
    );
  }

  const openModule = modules.find((m) => m.id === openModuleId);

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Program tools" title="Training" subtitle="Program modules and sessions, unlocked as you progress." />

        <TabBar tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t] }))} active={tab} onChange={setTab} />

        {isLoading && (
          <div className="space-y-3">
            <Skeleton tone="dark" className="h-28 rounded-2xl" />
            <Skeleton tone="dark" className="h-28 rounded-2xl" />
          </div>
        )}

        {!isLoading && tab === "modules" && !openModule && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} onOpen={() => setOpenModuleId(m.id)} />
            ))}
            {modules.length === 0 && <p className="ost-card-subtext">No training modules yet.</p>}
          </div>
        )}

        {!isLoading && tab === "modules" && openModule && (
          <div className="space-y-4">
            <button onClick={() => setOpenModuleId(null)} className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
              <ChevronLeft className="h-4 w-4" /> View all modules
            </button>
            <div>
              <h2 className="text-lg font-extrabold text-primary">Module {openModule.number} · {openModule.title}</h2>
              {openModule.description && <p className="mt-1 text-sm text-slate-500">{openModule.description}</p>}
            </div>
            <div className="space-y-3">
              {openModule.sessions.map((s) => <SessionRow key={s.id} session={s} onOpen={() => setOpenSession(s)} />)}
              {openModule.sessions.length === 0 && <p className="ost-card-subtext">No sessions scheduled yet for this module.</p>}
            </div>
          </div>
        )}

        {!isLoading && tab === "trainer" && <TrainerTab trainer={trainer} />}
        {!isLoading && tab === "sessionDetails" && <SessionDetailsTab modules={modules} />}
      </main>

      {openSession && <SessionDetailModal session={openSession} onClose={() => setOpenSession(null)} />}
    </AppShell>
  );
}

function TrainerTab({ trainer }: { trainer: TrainerProfile | null }) {
  if (!trainer) {
    return (
      <EmptyState
        icon={User}
        title="No trainer assigned yet"
        description="Once the OST team assigns you a trainer, their profile and contact details will show up here."
      />
    );
  }

  return (
    <div className="ost-card max-w-xl p-8">
      <div className="flex items-center gap-4">
        {trainer.pictureUrl ? (
          <img src={trainer.pictureUrl} alt={trainer.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <User className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="ost-card-title">{trainer.name}</h2>
          <p className="ost-helper-text">Your trainer</p>
        </div>
      </div>

      {trainer.introduction && <p className="mt-5 text-sm leading-relaxed text-slate-600">{trainer.introduction}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        {trainer.whatsapp && (
          <a
            href={`https://wa.me/${trainer.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="ost-btn-primary !px-3 !py-1.5 text-xs"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {trainer.email && (
          <a href={`mailto:${trainer.email}`} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
        )}
        {trainer.linkedinUrl && (
          <a href={trainer.linkedinUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Linkedin className="h-3.5 w-3.5" /> LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

function FlatSessionsTab({
  modules,
  emptyText,
  renderContent,
}: {
  modules: TrainingModuleData[];
  emptyText: string;
  renderContent: (session: TrainingSession) => React.ReactNode;
}) {
  const rows = modules
    .flatMap((m) => m.sessions.filter((s) => s.status === "completed").map((s) => ({ session: s, moduleNumber: m.number, moduleTitle: m.title })))
    .sort((a, b) => +new Date(a.session.scheduledAt) - +new Date(b.session.scheduledAt));

  if (rows.length === 0) return <p className="ost-card-subtext">{emptyText}</p>;

  return (
    <div className="space-y-3">
      {rows.map(({ session, moduleNumber, moduleTitle }) => (
        <div key={session.id} className="ost-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Module {moduleNumber} · {moduleTitle}</p>
              <p className="font-semibold text-primary">Session {session.number} · {session.title}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{new Date(session.scheduledAt).toLocaleDateString()}</span>
          </div>
          <div className="mt-3">{renderContent(session)}</div>
        </div>
      ))}
    </div>
  );
}

function SessionDetailsTab({ modules }: { modules: TrainingModuleData[] }) {
  return (
    <FlatSessionsTab
      modules={modules}
      emptyText="No completed sessions yet."
      renderContent={(s) => <SessionRecapForm session={s} />}
    />
  );
}

function SessionRecapForm({ session: s }: { session: TrainingSession }) {
  const queryClient = useQueryClient();
  const n = s.notes;
  const [teamMembersPresence, setTeamMembersPresence] = useState(n.teamMembersPresence ?? "");
  const [pointsDiscussed, setPointsDiscussed] = useState(n.pointsDiscussed ?? "");
  const [whatIsGoingWell, setWhatIsGoingWell] = useState(n.whatIsGoingWell ?? "");
  const [whatIsNotGoingWell, setWhatIsNotGoingWell] = useState(n.whatIsNotGoingWell ?? "");
  const [actionItems, setActionItems] = useState(n.actionItems ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/training/sessions/${s.id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ teamMembersPresence, pointsDiscussed, whatIsGoingWell, whatIsNotGoingWell, actionItems }),
      });
      queryClient.invalidateQueries({ queryKey: ["training"] });
      showToast("Recap saved");
    } catch (e: any) {
      showToast(e.message || "Couldn't save recap");
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string, (v: string) => void][] = [
    ["Team members presence", teamMembersPresence, setTeamMembersPresence],
    ["Points discussed", pointsDiscussed, setPointsDiscussed],
    ["What's going well", whatIsGoingWell, setWhatIsGoingWell],
    ["What's not going well", whatIsNotGoingWell, setWhatIsNotGoingWell],
    ["Action items", actionItems, setActionItems],
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value, setValue]) => (
              <tr key={label} className="border-b border-slate-50 last:border-0">
                <th scope="row" className="w-44 py-2 pr-4 text-left align-top text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</th>
                <td className="py-2 align-top">
                  <textarea
                    className="ost-input min-h-[44px] w-full text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="—"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

function ModuleCard({ module: m, onOpen }: { module: TrainingModuleData; onOpen: () => void }) {
  const locked = m.status === "locked";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onOpen}
      disabled={locked}
      className={`ost-card flex flex-col items-start p-6 text-left transition ${
        locked ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-card-hover"
      }`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
          {locked ? <Lock className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
        </div>
        <StatusBadge tone={MODULE_STATUS_TONES[m.status]}>{MODULE_STATUS_LABELS[m.status]}</StatusBadge>
      </div>
      <h3 className="mt-4 font-bold text-primary">Module {m.number} · {m.title}</h3>
      {m.description && <p className="mt-1 text-sm text-slate-500">{m.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {m.durationLabel && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.durationLabel}</span>}
        {!locked && <span>{m.completedSessionsCount} of {m.totalSessionsCount} sessions completed</span>}
      </div>
      {!locked && (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

function SessionRow({ session: s, onOpen }: { session: TrainingSession; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ost-card flex w-full items-center justify-between gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary">Session {s.number} · {s.title}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          <CalendarClock className="h-3 w-3" /> {new Date(s.scheduledAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge tone={MENTORSHIP_SESSION_STATUS_TONES[s.status]} icon={MENTORSHIP_SESSION_STATUS_ICONS[s.status]}>{s.status}</StatusBadge>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}

function SessionDetailModal({ session: s, onClose }: { session: TrainingSession; onClose: () => void }) {
  return (
    <ModalShell
      title={`Session ${s.number} · ${s.title}`}
      subtitle={`${new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })} · ${s.durationMinutes} min`}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      {s.description && <p className="text-sm leading-relaxed text-slate-600">{s.description}</p>}
      {s.experts && <p className="mt-3 text-sm font-semibold text-primary">{s.experts}</p>}
      {s.trainerBio && <p className="mt-1 text-xs italic text-slate-400">{s.trainerBio}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        {s.status === "upcoming" && s.meetingLink && (
          <a href={s.meetingLink} target="_blank" rel="noreferrer" className="ost-btn-primary !px-3 !py-1.5 text-xs">
            <Video className="h-3.5 w-3.5" /> Join
          </a>
        )}
        {s.status === "upcoming" && !s.meetingLink && (
          <a href={googleCalendarLink(s.title, s.scheduledAt, s.durationMinutes)} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Link2 className="h-3.5 w-3.5" /> Add to calendar
          </a>
        )}
        {s.status === "completed" && s.recordingUrl && (
          <a href={s.recordingUrl} target="_blank" rel="noreferrer" className="ost-btn-primary !px-3 !py-1.5 text-xs">
            <Video className="h-3.5 w-3.5" /> Recording
          </a>
        )}
        {s.status === "completed" && s.meetingLink && (
          <a href={s.meetingLink} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Video className="h-3.5 w-3.5" /> Meeting link
          </a>
        )}
        {s.presentationUrl && (
          <a href={s.presentationUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Presentation className="h-3.5 w-3.5" /> Presentation
          </a>
        )}
        {s.transcriptUrl && (
          <a href={s.transcriptUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Transcript
          </a>
        )}
        {!s.meetingLink && !s.recordingUrl && !s.presentationUrl && !s.transcriptUrl && s.status === "completed" && (
          <p className="text-xs text-slate-400">Materials will be added here soon.</p>
        )}
      </div>
    </ModalShell>
  );
}
