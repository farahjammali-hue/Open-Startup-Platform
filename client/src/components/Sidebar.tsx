import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { confirmLeave } from "../lib/navGuard";
import { useKysStatus } from "../lib/kysStatus";
import { showToast } from "../lib/toast";
import { SquaresFour as LayoutDashboard, Rocket, Trash as Trash2, Users, UserCheck, Lock, Wrench, Wallet, Storefront as Store, BookOpen, Chats as MessagesSquare, FolderLock, House as HomeIcon, FileText, Stack as Layers, Presentation, Handshake } from "@phosphor-icons/react";

interface Item {
  label: string;
  to?: string;
  icon: any;
  soon?: boolean;
  lockedIf?: boolean;
}

const ADMIN_GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
      // Ask AI is hidden from the nav for the moment; route/page stay intact.
    ],
  },
  {
    label: "Startups",
    items: [
      { label: "Startups", to: "/admin/startups", icon: Rocket },
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Signup Approvals", to: "/admin/approvals", icon: UserCheck },
      { label: "Deletion Requests", to: "/admin/deletion-requests", icon: Trash2 },
    ],
  },
  {
    label: "Program",
    items: [
      // Training is shared across every startup on the same track (sessions
      // are authored once and targeted to many), so it lives here rather
      // than as a per-startup-only module.
      { label: "Training", to: "/admin/training", icon: Presentation },
      // Contracts & KYS, Data Room, Mentorship, and CRM are hidden from the
      // nav — each is reachable per-startup from its module card on
      // /admin/startups/:id; routes/pages stay intact. Open Startup School
      // is hidden too; route/page stay intact.
    ],
  },
  {
    label: "Coming soon",
    items: [
      { label: "Programs", icon: Rocket, soon: true },
      { label: "Tools", icon: Wrench, soon: true },
      { label: "Capital", icon: Wallet, soon: true },
      { label: "Marketplace", icon: Store, soon: true },
      { label: "Resources", icon: BookOpen, soon: true },
      { label: "Forums", icon: MessagesSquare, soon: true },
    ],
  },
];

interface StartupProfile {
  companyName: string;
  logoUrl: string | null;
  stage: string | null;
}

export function Sidebar() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const { kysSubmitted } = useKysStatus();
  const { data: startup } = useQuery<StartupProfile>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
    enabled: !isAdmin,
  });

  const STARTUP_GROUPS: { label: string; items: Item[] }[] = [
    { label: "Overview", items: [{ label: "Home", to: "/", icon: HomeIcon }] },
    {
      label: "Priority",
      items: [
        { label: "Contract & KYS", to: "/contract-kys", icon: FileText },
        { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, lockedIf: !kysSubmitted },
        { label: "Data Room", to: "/data-room", icon: FolderLock, lockedIf: !kysSubmitted },
      ],
    },
    {
      label: "Program Tools",
      items: [
        { label: "Mentorship", to: "/mentorship", icon: Layers, lockedIf: !kysSubmitted },
        { label: "Training", to: "/training", icon: Presentation, lockedIf: !kysSubmitted },
        { label: "CRM", to: "/crm", icon: Handshake, lockedIf: !kysSubmitted },
        // KPI Visualizations, Office Hours, and Open Startup School are
        // hidden from the nav for now; routes/pages stay intact.
      ],
    },
  ];

  const groups = isAdmin ? ADMIN_GROUPS : STARTUP_GROUPS;

  function go(to?: string, lockedIf?: boolean) {
    if (!to) return;
    if (lockedIf) {
      showToast("Complete Contract & KYS first to unlock this.");
      return;
    }
    if (confirmLeave()) navigate(to);
  }

  function renderItem(it: Item) {
    const Icon = it.icon;
    const active = it.to && (location === it.to || (it.to !== "/admin" && it.to !== "/" && location.startsWith(it.to)));
    if (it.soon) {
      return (
        <div key={it.label} className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/30">
          <span className="flex items-center gap-3"><Icon className="h-5 w-5" /> {it.label}</span>
          <Lock className="h-4 w-4" />
        </div>
      );
    }
    // .nav-item's own base color (var(--text-2), tuned for a light nav) is
    // more specific than a plain Tailwind text-white/NN utility here (it's
    // nested under .brand-tokens-root), so the inactive/locked colors are
    // set inline to guarantee they win on this navy sidebar; the active
    // state is left to .nav-item[aria-current="page"] itself, which is
    // exactly the white-pill-with-turquoise-bar look it's meant to produce.
    return (
      <button
        key={it.label}
        onClick={() => go(it.to, it.lockedIf)}
        aria-current={active ? "page" : undefined}
        style={active ? undefined : { color: it.lockedIf ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.7)" }}
        className={`nav-item flex w-full items-center gap-3 text-sm font-medium transition ${
          active ? "" : "hover:bg-white/5 hover:!text-white"
        }`}
      >
        <Icon className="h-5 w-5" /> {it.label}
        {it.lockedIf && <Lock className="ml-auto h-4 w-4" />}
      </button>
    );
  }

  const onboardingPct = kysSubmitted ? 100 : 35;

  return (
    <aside className="brand-tokens-root hidden w-60 shrink-0 flex-col border-r border-white/10 bg-primary md:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <button onClick={() => go("/")}>
          <img src="/logos/logo-offwhite.svg" alt="Open Startup Platform" className="h-6 w-auto" />
        </button>
      </div>

      {!isAdmin && startup && (
        <div className="mx-4 mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] font-bold text-primary" style={{ background: "linear-gradient(135deg, #5CD45E, #62DDD1)" }}>
              {startup.companyName?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{startup.companyName}</div>
              <div className="truncate text-[11px] text-white/50">{kysSubmitted ? "Onboarding complete" : "Onboarding in progress"}</div>
            </div>
          </div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/50">
            <span>Onboarding</span>
            <span>{onboardingPct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuenow={onboardingPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full transition-all" style={{ width: `${onboardingPct}%`, background: "var(--yellow)" }} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-2 pb-1.5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40 first:pt-0">{group.label}</p>
            <nav className="space-y-1">{group.items.map(renderItem)}</nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
