import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { RoadGlow } from "../components/Brand";
import { useKysStatus } from "../lib/kysStatus";
import { showToast } from "../lib/toast";
import { StatusBadge, TONE_CLASSES, type StatusTone } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import {
  FileText, LayoutDashboard, FolderLock, Lock, BarChart3, CalendarClock, Layers, GraduationCap,
  AlertTriangle, CheckCircle2, ArrowRight, Video,
} from "lucide-react";

interface StartupProfile {
  companyName: string;
  stage: string | null;
}

interface MentorshipSessionLite {
  id: string;
  title: string;
  scheduledAt: string;
  status: "upcoming" | "completed";
  meetingLink: string | null;
}

interface OfficeHourBookingLite {
  id: string;
  status: "booked" | "cancelled";
  topic: string | null;
  slot: { startsAt: string; hostName: string; topic: string | null; meetingLink: string | null };
}

interface UpcomingItem {
  id: string;
  kind: "mentorship" | "office-hours";
  title: string;
  date: string;
  joinUrl: string | null;
  linkTo: string;
}

const EXPLORE_TOOLS = [
  { icon: Layers, title: "Mentorship", desc: "Sessions with your mentor", to: "/mentorship", gated: true },
  { icon: BarChart3, title: "KPI visualizations", desc: "Auto-built charts", to: "/kpi", gated: false },
  { icon: CalendarClock, title: "Office hours", desc: "Book time with OST", to: "/office-hours", gated: false },
  { icon: GraduationCap, title: "Open Startup School", desc: "Unlocks over time", to: "/school", gated: false },
];

export default function Home() {
  const [, navigate] = useLocation();
  const { kysSubmitted, contractRejected, kysRejected, isLoading: kysLoading } = useKysStatus();
  const needsAttention = contractRejected || kysRejected;

  const { data: startup } = useQuery<StartupProfile>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
  });

  const { data: mentorshipData, isLoading: mentorshipLoading } = useQuery<{ sessions: MentorshipSessionLite[] }>({
    queryKey: ["mentorship"],
    queryFn: () => api("/api/mentorship"),
    enabled: kysSubmitted,
  });

  const { data: officeHoursData, isLoading: officeHoursLoading } = useQuery<{ bookings: OfficeHourBookingLite[] }>({
    queryKey: ["office-hours-bookings"],
    queryFn: () => api("/api/office-hours/bookings"),
  });

  const upcomingLoading = officeHoursLoading || (kysSubmitted && mentorshipLoading);

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const now = Date.now();
    const mentorshipItems: UpcomingItem[] = (mentorshipData?.sessions ?? [])
      .filter((s) => s.status === "upcoming" && +new Date(s.scheduledAt) >= now)
      .map((s) => ({ id: `mentorship-${s.id}`, kind: "mentorship", title: s.title, date: s.scheduledAt, joinUrl: s.meetingLink, linkTo: "/mentorship" }));

    const officeHourItems: UpcomingItem[] = (officeHoursData?.bookings ?? [])
      .filter((b) => b.status === "booked" && +new Date(b.slot.startsAt) >= now)
      .map((b) => ({
        id: `office-hours-${b.id}`,
        kind: "office-hours",
        title: b.topic || b.slot.topic || `Office hours with ${b.slot.hostName}`,
        date: b.slot.startsAt,
        joinUrl: b.slot.meetingLink,
        linkTo: "/office-hours",
      }));

    return [...mentorshipItems, ...officeHourItems].sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, 3);
  }, [mentorshipData, officeHoursData]);

  const nextUp = upcoming[0];

  function goLocked() {
    showToast("Complete Contract & KYS first to unlock this.");
  }

  if (kysLoading) return null;

  return (
    <AppShell>
      <main className="relative ost-page overflow-x-hidden">
        <RoadGlow
          viewBox="0 0 600 260"
          path="M40,220 C140,180 120,90 230,70 C330,52 360,140 460,110 C500,98 520,80 560,40"
          className="pointer-events-none absolute -right-5 -top-4 z-0 h-auto w-[440px] max-w-[60%] opacity-50"
        />
        <div className="relative">
          <span className="ost-eyebrow">Your road, in motion</span>
          <h1 className="mt-2 ost-page-title">
            Welcome back, <span className="text-secondary-300">{startup?.companyName ?? "founder"}</span>
          </h1>
        </div>

        {/* Tier 1 — Next action: the one thing to do next, always singular. */}
        {needsAttention ? (
          <NextActionHero
            tone="red"
            icon={AlertTriangle}
            title="Changes requested on your Contract & KYS"
            description="The OST team asked for updates before this can move forward."
            ctaLabel="Review & resubmit"
            onCta={() => navigate("/contract-kys")}
          />
        ) : !kysSubmitted ? (
          <NextActionHero
            tone="amber"
            icon={FileText}
            title="Complete your Contract & KYS"
            description="Sign your program agreement and submit your startup profile to unlock the rest of the platform."
            ctaLabel="Start now"
            onCta={() => navigate("/contract-kys")}
          />
        ) : nextUp ? (
          <NextActionHero
            tone="teal"
            icon={Video}
            title={`Coming up: ${nextUp.title}`}
            description={new Date(nextUp.date).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
            ctaLabel={nextUp.joinUrl ? "Join now" : "View details"}
            ctaHref={nextUp.joinUrl ?? undefined}
            onCta={nextUp.joinUrl ? undefined : () => navigate(nextUp.linkTo)}
          />
        ) : (
          <NextActionHero
            tone="primary"
            icon={CheckCircle2}
            title="You're all caught up"
            description="Nothing needs your attention right now. Explore your program tools below."
          />
        )}

        {/* Tier 2 — Upcoming (omitted entirely once loaded with nothing to show) */}
        {upcomingLoading ? (
          <section className="mt-10">
            <h2 className="ost-section-label mb-3">Upcoming</h2>
            <Skeleton tone="dark" className="h-16 rounded-xl" />
          </section>
        ) : upcoming.length > 0 ? (
          <section className="mt-10">
            <h2 className="ost-section-label mb-3">Upcoming</h2>
            <div className="space-y-2">
              {upcoming.map((item) => (
                <UpcomingRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Tier 3 — Progress */}
        <ProgressSummary kysSubmitted={kysSubmitted} needsAttention={needsAttention} />

        {/* Tier 4 — Explore tools */}
        <section className="mt-10">
          <h2 className="ost-section-label mb-3">Explore tools</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EXPLORE_TOOLS.map((t) => {
              const locked = t.gated && !kysSubmitted;
              return (
                <button
                  key={t.title}
                  onClick={() => (locked ? goLocked() : navigate(t.to))}
                  className={`ost-panel flex flex-col items-start gap-2 p-4 text-left transition ${
                    locked ? "opacity-50" : "hover:border-secondary/40"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <t.icon className="h-4 w-4 text-secondary" />
                    {locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                  <span className="text-sm font-bold text-primary">{t.title}</span>
                  <span className="ost-helper-text">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function NextActionHero({
  tone,
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  tone: StatusTone;
  icon: any;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  const BORDER_BY_TONE: Record<StatusTone, string> = {
    red: "border-l-red-400",
    amber: "border-l-amber-400",
    teal: "border-l-turq",
    gray: "border-l-slate-200",
    primary: "border-l-secondary/50",
  };

  return (
    <div className={`ost-card mt-8 flex flex-col items-start gap-5 border-l-4 p-8 sm:flex-row sm:items-center sm:justify-between ${BORDER_BY_TONE[tone]}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="ost-card-title text-lg">{title}</h2>
          <p className="mt-1 ost-card-subtext max-w-lg">{description}</p>
        </div>
      </div>
      {ctaLabel && (
        ctaHref ? (
          <a href={ctaHref} target="_blank" rel="noreferrer" className="ost-btn-primary shrink-0">
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <button onClick={onCta} className="ost-btn-primary shrink-0">
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </button>
        )
      )}
    </div>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const date = new Date(item.date);
  return (
    <div className="ost-panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <StatusBadge tone={item.kind === "mentorship" ? "teal" : "primary"}>
          {item.kind === "mentorship" ? "Mentorship" : "Office hours"}
        </StatusBadge>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{item.title}</p>
          <p className="ost-helper-text">{date.toLocaleString()}</p>
        </div>
      </div>
      {item.joinUrl && (
        <a href={item.joinUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-3 !py-1.5 text-xs shrink-0">
          <Video className="h-3.5 w-3.5" /> Join
        </a>
      )}
    </div>
  );
}

function ProgressSummary({ kysSubmitted, needsAttention }: { kysSubmitted: boolean; needsAttention: boolean }) {
  const items: { label: string; tone: StatusTone; text: string }[] = [
    {
      label: "Contract & KYS",
      tone: needsAttention ? "red" : kysSubmitted ? "teal" : "amber",
      text: needsAttention ? "Changes requested" : kysSubmitted ? "Complete" : "Action needed",
    },
    { label: "Dashboard", tone: kysSubmitted ? "teal" : "gray", text: kysSubmitted ? "Available" : "Locked" },
    { label: "Data room", tone: kysSubmitted ? "teal" : "gray", text: kysSubmitted ? "Available" : "Locked" },
    { label: "Mentorship", tone: kysSubmitted ? "teal" : "gray", text: kysSubmitted ? "Available" : "Locked" },
  ];

  return (
    <section className="mt-10">
      <h2 className="ost-section-label mb-3">Progress</h2>
      <div className="ost-panel flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        {items.map((it, i) => (
          <div key={it.label} className={`flex items-center gap-2 ${i > 0 ? "sm:border-l sm:border-slate-100 sm:pl-8" : ""}`}>
            <span className="ost-helper-text font-semibold uppercase tracking-wide">{it.label}</span>
            <StatusBadge tone={it.tone}>{it.text}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  );
}
