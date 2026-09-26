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
import { EmptyState } from "../components/EmptyState";
import { FileText, SquaresFour as LayoutDashboard, FolderLock, Lock, Stack as Layers, Presentation, Handshake, Warning as AlertTriangle, CheckCircle as CheckCircle2, ArrowRight, VideoCamera as Video } from "@phosphor-icons/react";

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

// Open Startup School is hidden from this tile grid for now; its route/page stay intact.
const EXPLORE_TOOLS = [
  { icon: Layers, title: "Mentorship", desc: "Sessions with your mentor", to: "/mentorship", gated: true },
  { icon: Presentation, title: "Training", desc: "Modules & sessions", to: "/training", gated: true },
  { icon: Handshake, title: "CRM", desc: "Investors, clients & partners", to: "/crm", gated: true },
];

export default function Home() {
  const [, navigate] = useLocation();
  const { onboardingComplete, contractRejected, kysRejected, isLoading: kysLoading } = useKysStatus();
  const needsAttention = contractRejected || kysRejected;

  const { data: startup, isError: noStartup } = useQuery<StartupProfile>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
    retryOnMount: false,
  });

  const { data: mentorshipData, isLoading: mentorshipLoading } = useQuery<{ sessions: MentorshipSessionLite[] }>({
    queryKey: ["mentorship"],
    queryFn: () => api("/api/mentorship"),
    enabled: onboardingComplete,
  });

  // A5: nudge for the current month's metrics. Same emptiness rule as the
  // admin side: an entry with at least one value counts as submitted.
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const { data: metricsData } = useQuery<{ entries: { period: string; values: Record<string, unknown> }[] }>({
    queryKey: ["metrics-panel", "/api/metrics"],
    queryFn: () => api("/api/metrics"),
    enabled: onboardingComplete,
  });
  const monthlyUpdateMissing =
    !!metricsData && !metricsData.entries.some((e) => e.period === currentPeriod && Object.keys(e.values ?? {}).length > 0);

  const { data: officeHoursData, isLoading: officeHoursLoading } = useQuery<{ bookings: OfficeHourBookingLite[] }>({
    queryKey: ["office-hours-bookings"],
    queryFn: () => api("/api/office-hours/bookings"),
  });

  const upcomingLoading = officeHoursLoading || (onboardingComplete && mentorshipLoading);

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

  // An onboarded founder account can end up with no startup (e.g. its only
  // startup was deleted). Everything else on Home needs one, so offer to
  // create it instead of rendering a page of failed requests.
  if (noStartup) {
    return (
      <AppShell>
        <main className="ost-page">
          <EmptyState
            icon={FileText}
            title="No startup on this account yet"
            description="Create your startup profile to start the program: sign your contract, complete your KYS, and unlock the dashboard."
            actionLabel="Create your startup"
            onAction={() => navigate("/startups/new")}
          />
        </main>
      </AppShell>
    );
  }

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
            description="The Open Startup team asked for updates before this can move forward."
            ctaLabel="Review & resubmit"
            onCta={() => navigate("/contract-kys")}
          />
        ) : !onboardingComplete ? (
          <NextActionHero
            tone="amber"
            icon={FileText}
            title="Complete your KYS & Contract"
            description="Fill in your Know Your Startup form, then sign your program agreement, to unlock the rest of the platform."
            ctaLabel="Start now"
            onCta={() => navigate("/contract-kys")}
          />
        ) : monthlyUpdateMissing ? (
          <NextActionHero
            tone="amber"
            icon={LayoutDashboard}
            title={`Submit your ${new Date().toLocaleString(undefined, { month: "long" })} update`}
            description="Your monthly metrics for this month haven't been saved yet. It takes a few minutes and keeps your progress visible to the program team."
            ctaLabel="Fill it in"
            onCta={() => navigate("/dashboard")}
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
        <ProgressSummary onboardingComplete={onboardingComplete} needsAttention={needsAttention} />

        {/* Tier 4 — Explore tools */}
        <section className="mt-10">
          <h2 className="ost-section-label mb-3">Explore tools</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EXPLORE_TOOLS.map((t) => {
              const locked = t.gated && !onboardingComplete;
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
                    {locked && <Lock className="h-4 w-4 text-slate-400" />}
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
          <Icon className="h-6 w-6" />
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
          <Video className="h-4 w-4" /> Join
        </a>
      )}
    </div>
  );
}

function ProgressSummary({ onboardingComplete, needsAttention }: { onboardingComplete: boolean; needsAttention: boolean }) {
  const items: { label: string; tone: StatusTone; text: string }[] = [
    {
      label: "Contract & KYS",
      tone: needsAttention ? "red" : onboardingComplete ? "teal" : "amber",
      text: needsAttention ? "Changes requested" : onboardingComplete ? "Complete" : "Action needed",
    },
    { label: "Dashboard", tone: onboardingComplete ? "teal" : "gray", text: onboardingComplete ? "Available" : "Locked" },
    { label: "Data room", tone: onboardingComplete ? "teal" : "gray", text: onboardingComplete ? "Available" : "Locked" },
    { label: "Mentorship", tone: onboardingComplete ? "teal" : "gray", text: onboardingComplete ? "Available" : "Locked" },
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
