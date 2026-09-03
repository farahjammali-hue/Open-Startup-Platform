import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { Logo } from "./Brand";
import { confirmLeave } from "../lib/navGuard";
import { useKysStatus } from "../lib/kysStatus";
import { showToast } from "../lib/toast";
import {
  LayoutDashboard, Rocket, Trash2, Users, Lock,
  GraduationCap, Wrench, Wallet, Store, BookOpen, MessagesSquare,
  FolderLock, CalendarClock, Home as HomeIcon, FileText, BarChart3, Contact, Layers, Presentation,
} from "lucide-react";

interface Item {
  label: string;
  to?: string;
  icon: any;
  soon?: boolean;
  lockedIf?: boolean;
}

const ADMIN_ITEMS: Item[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Startups", to: "/admin/startups", icon: Rocket },
  { label: "Contracts & KYS", to: "/admin/contracts-kys", icon: FileText },
  { label: "Data Room", to: "/admin/data-room", icon: FolderLock },
  { label: "KPI Submissions", to: "/admin/kpi", icon: BarChart3 },
  { label: "Monthly Updates", to: "/admin/monthly-updates", icon: CalendarClock },
  { label: "Mentorship", to: "/admin/mentorship", icon: Layers },
  { label: "Training", to: "/admin/training", icon: Presentation },
  { label: "Team Rosters", to: "/admin/team", icon: Contact },
  { label: "Open Startup School", to: "/admin/school", icon: GraduationCap },
  { label: "Deletion Requests", to: "/admin/deletion-requests", icon: Trash2 },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Programs", icon: Rocket, soon: true },
  { label: "Tools", icon: Wrench, soon: true },
  { label: "Capital", icon: Wallet, soon: true },
  { label: "Marketplace", icon: Store, soon: true },
  { label: "Resources", icon: BookOpen, soon: true },
  { label: "Forums", icon: MessagesSquare, soon: true },
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
        // KPI Visualizations and Office Hours are hidden from the nav for
        // now while they get more development; routes/pages stay intact.
      ],
    },
    { label: "Learning", items: [{ label: "Open Startup School", to: "/school", icon: GraduationCap }] },
  ];

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
          <span className="flex items-center gap-3"><Icon className="h-[18px] w-[18px]" /> {it.label}</span>
          <Lock className="h-3 w-3" />
        </div>
      );
    }
    return (
      <button
        key={it.label}
        onClick={() => go(it.to, it.lockedIf)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          it.lockedIf
            ? "text-white/30"
            : active
              ? "border border-secondary/30 bg-secondary/15 text-white"
              : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" /> {it.label}
        {it.lockedIf && <Lock className="ml-auto h-3 w-3" />}
      </button>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-primary md:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <button onClick={() => go("/")}>
          <Logo compact className="[&_*]:text-white" />
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
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: kysSubmitted ? "100%" : "35%", background: "linear-gradient(90deg, #FF3D82, #62DDD1)" }} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {isAdmin ? (
          <>
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">Administration</p>
            <nav className="space-y-1">{ADMIN_ITEMS.map(renderItem)}</nav>
          </>
        ) : (
          STARTUP_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-2 pb-1.5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40 first:pt-0">{group.label}</p>
              <nav className="space-y-1">{group.items.map(renderItem)}</nav>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
