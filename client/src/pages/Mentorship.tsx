import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ModalShell } from "../components/ModalShell";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { useKysStatus } from "../lib/kysStatus";
import { showToast } from "../lib/toast";
import { MENTORSHIP_SESSION_STATUS_TONES, MENTORSHIP_SESSION_STATUS_ICONS } from "../lib/statusTones";
import {
  Lock, ChevronRight, Video, FileText, Link2, Loader2,
  CalendarClock, User, Users, Paperclip,
} from "lucide-react";

interface MentorshipSessionNotes {
  teamMembersPresence: string | null;
  pointsDiscussed: string | null;
  actionItems: string | null;
  aiGeneratedAt: string | null;
  founderComments: string | null;
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
  notes: MentorshipSessionNotes;
}

interface ExpertProfile {
  id: string;
  name: string;
  bio: string | null;
  industries: string[] | null;
  expertiseAreas: string[] | null;
}

const TABS = ["mentor", "sessions", "sessionsRecap", "otherExperts"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  mentor: "Mentor",
  sessions: "Sessions",
  sessionsRecap: "Sessions recap",
  otherExperts: "Other experts",
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

export default function Mentorship() {
  const [, navigate] = useLocation();
  const { kysSubmitted, isLoading: kysLoading } = useKysStatus();
  const [tab, setTab] = useState<Tab>("mentor");
  const [openSession, setOpenSession] = useState<MentorshipSession | null>(null);
  const [openExpert, setOpenExpert] = useState<ExpertProfile | null>(null);

  const { data, isLoading } = useQuery<{ sessions: MentorshipSession[]; mentor: ExpertProfile | null }>({
    queryKey: ["mentorship"],
    queryFn: () => api("/api/mentorship"),
    enabled: kysSubmitted,
  });

  const { data: expertsData, isLoading: expertsLoading } = useQuery<{ experts: ExpertProfile[] }>({
    queryKey: ["other-experts"],
    queryFn: () => api("/api/other-experts"),
    enabled: kysSubmitted,
  });

  const sessions = data?.sessions ?? [];
  const mentor = data?.mentor ?? null;
  const otherExperts = expertsData?.experts ?? [];

  if (kysLoading) return null;

  if (!kysSubmitted) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink />
          <PageHeader eyebrow="Program tools" title="Mentorship" subtitle="Your mentorship sessions, in one place." />
          <div className="mt-8">
            <EmptyState
              icon={Lock}
              title="Complete your KYC to unlock mentorship"
              description="Finish your Contract & KYS submission to access your sessions."
              actionLabel="Go to Contract & KYS"
              onAction={() => navigate("/contract-kys")}
            />
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Program tools" title="Mentorship" subtitle="Your mentorship sessions, in one place." />

        <TabBar tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t] }))} active={tab} onChange={setTab} />

        {isLoading && (
          <div className="space-y-3">
            <Skeleton tone="dark" className="h-20 rounded-2xl" />
            <Skeleton tone="dark" className="h-20 rounded-2xl" />
          </div>
        )}

        {!isLoading && tab === "sessions" && (
          <div className="space-y-3">
            {sessions.map((s) => <SessionRow key={s.id} session={s} onOpen={() => setOpenSession(s)} />)}
            {sessions.length === 0 && <p className="ost-card-subtext">No sessions scheduled yet.</p>}
          </div>
        )}

        {!isLoading && tab === "mentor" && <MentorTab mentor={mentor} />}

        {!isLoading && tab === "sessionsRecap" && <SessionsRecapTab sessions={sessions} />}

        {tab === "otherExperts" && (
          expertsLoading ? (
            <div className="space-y-3">
              <Skeleton tone="dark" className="h-10 rounded-lg" />
              <Skeleton tone="dark" className="h-10 rounded-lg" />
              <Skeleton tone="dark" className="h-10 rounded-lg" />
            </div>
          ) : (
            <OtherExpertsTab experts={otherExperts} onOpen={setOpenExpert} />
          )
        )}
      </main>

      {openSession && <SessionDetailModal session={openSession} onClose={() => setOpenSession(null)} />}
      {openExpert && <ExpertDetailModal expert={openExpert} onClose={() => setOpenExpert(null)} />}
    </AppShell>
  );
}

function MentorTab({ mentor }: { mentor: ExpertProfile | null }) {
  if (!mentor) {
    return (
      <EmptyState
        icon={User}
        title="No mentor assigned yet"
        description="Once the OST team assigns you a mentor, their profile and contact details will show up here."
      />
    );
  }

  return (
    <div className="ost-card max-w-xl p-8">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
          <User className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h2 className="ost-card-title">{mentor.name}</h2>
          <p className="ost-helper-text">Your mentor</p>
        </div>
      </div>

      {mentor.bio && <p className="mt-5 text-sm leading-relaxed text-slate-600">{mentor.bio}</p>}

      {!!mentor.industries?.length && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="ost-helper-text mb-1.5 font-bold">Industry / Technology</p>
          <div className="flex flex-wrap gap-1.5">
            {mentor.industries.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {!!mentor.expertiseAreas?.length && (
        <div className="mt-3">
          <p className="ost-helper-text mb-1.5 font-bold">Areas of Expertise</p>
          <div className="flex flex-wrap gap-1.5">
            {mentor.expertiseAreas.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OtherExpertsTab({ experts, onOpen }: { experts: ExpertProfile[]; onOpen: (e: ExpertProfile) => void }) {
  if (experts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No experts in the catalog yet"
        description="Experts the OST team adds will show up here for you to browse."
      />
    );
  }

  return (
    <div className="ost-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-semibold">Expert</th>
              <th className="px-5 py-3 font-semibold">Industry / Technology</th>
              <th className="px-5 py-3 font-semibold">Areas of Expertise</th>
            </tr>
          </thead>
          <tbody>
            {experts.map((e) => (
              <tr
                key={e.id}
                onClick={() => onOpen(e)}
                className="cursor-pointer border-b border-slate-50 align-top last:border-0 hover:bg-slate-50"
              >
                <td className="max-w-[160px] px-5 py-3 font-semibold text-primary">{e.name}</td>
                <td className="max-w-[220px] px-5 py-3 text-slate-500">{(e.industries ?? []).join(", ") || "—"}</td>
                <td className="max-w-[280px] px-5 py-3 text-slate-500">{(e.expertiseAreas ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpertDetailModal({ expert: e, onClose }: { expert: ExpertProfile; onClose: () => void }) {
  return (
    <ModalShell title={e.name} onClose={onClose} maxWidth="max-w-lg">
      {e.bio && <p className="text-sm leading-relaxed text-slate-600">{e.bio}</p>}

      {!!e.industries?.length && (
        <div className="mt-4">
          <p className="ost-helper-text mb-1.5 font-bold">Industry / Technology</p>
          <div className="flex flex-wrap gap-1.5">
            {e.industries.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {!!e.expertiseAreas?.length && (
        <div className="mt-3">
          <p className="ost-helper-text mb-1.5 font-bold">Areas of Expertise</p>
          <div className="flex flex-wrap gap-1.5">
            {e.expertiseAreas.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function SessionsRecapTab({ sessions }: { sessions: MentorshipSession[] }) {
  const sorted = [...sessions].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));

  if (sorted.length === 0) return <p className="ost-card-subtext">No sessions scheduled yet.</p>;

  return (
    <div className="space-y-3">
      {sorted.map((s) => (
        <div key={s.id} className="ost-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <p className="font-semibold text-primary">Session {s.number} · {s.title}</p>
            <span className="shrink-0 text-xs text-slate-400">{new Date(s.scheduledAt).toLocaleDateString()}</span>
          </div>
          <div className="mt-3"><SessionRecapCard session={s} /></div>
        </div>
      ))}
    </div>
  );
}

function SessionRecapCard({ session: s }: { session: MentorshipSession }) {
  const queryClient = useQueryClient();
  const n = s.notes;
  const [founderComments, setFounderComments] = useState(n.founderComments ?? "");
  const [saving, setSaving] = useState(false);

  async function saveComments() {
    setSaving(true);
    try {
      await api(`/api/mentorship/sessions/${s.id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ founderComments }),
      });
      queryClient.invalidateQueries({ queryKey: ["mentorship"] });
      showToast("Comments saved");
    } catch (e: any) {
      showToast(e.message || "Couldn't save comments");
    } finally {
      setSaving(false);
    }
  }

  const recapRows: [string, string | null][] = [
    ["Team members presence", n.teamMembersPresence],
    ["Points discussed", n.pointsDiscussed],
    ["Action items", n.actionItems],
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="ost-label !mb-0">Session recap</p>
          {n.aiGeneratedAt && <span className="text-xs text-slate-400">Generated by AI · {new Date(n.aiGeneratedAt).toLocaleDateString()}</span>}
        </div>
        {n.aiGeneratedAt ? (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <tbody>
                {recapRows.map(([label, value]) => (
                  <tr key={label} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="w-44 py-2 pl-3 pr-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</th>
                    <td className="whitespace-pre-wrap py-2 pr-3 align-top text-slate-600">{value || <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            {s.status === "completed"
              ? "Will appear here automatically once available."
              : "Will be generated automatically after this session is held."}
          </p>
        )}
      </div>

      <div>
        <label className="ost-label">Your comments</label>
        <textarea
          className="ost-input mb-2 min-h-[60px] w-full text-sm"
          value={founderComments}
          onChange={(e) => setFounderComments(e.target.value)}
          placeholder="Add notes about this session — questions, context for your mentor, anything you want on record."
        />
        <div className="flex justify-end">
          <button type="button" onClick={saveComments} disabled={saving} className="ost-btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session: s, onOpen }: { session: MentorshipSession; onOpen: () => void }) {
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

function SessionDetailModal({ session: s, onClose }: { session: MentorshipSession; onClose: () => void }) {
  return (
    <ModalShell
      title={`Session ${s.number} · ${s.title}`}
      subtitle={`${new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })} · ${s.durationMinutes} min`}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      {s.description && <p className="text-sm leading-relaxed text-slate-600">{s.description}</p>}
      {s.experts && <p className="mt-3 text-sm font-semibold text-primary">{s.experts}</p>}
      {s.mentorBio && <p className="mt-1 text-xs italic text-slate-400">{s.mentorBio}</p>}

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
        {s.transcriptUrl && (
          <a href={s.transcriptUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Transcript
          </a>
        )}
        {s.materialsUrl && (
          <a href={s.materialsUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs">
            <Paperclip className="h-3.5 w-3.5" /> Materials
          </a>
        )}
        {!s.meetingLink && !s.recordingUrl && !s.transcriptUrl && !s.materialsUrl && s.status === "completed" && (
          <p className="text-xs text-slate-400">Materials will be added here soon.</p>
        )}
      </div>
    </ModalShell>
  );
}
