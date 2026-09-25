import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useViewMode } from "../lib/viewMode";
import { api } from "../lib/utils";
import { confirmLeave } from "../lib/navGuard";
import { Dropdown } from "./Dropdown";
import { CaretDown as ChevronDown, Check, Buildings as Building2, SignOut as LogOut, Gear as Settings, ShieldCheck, Rocket } from "@phosphor-icons/react";

/** Admin-only: flip between the admin console and a preview of the founder-facing app. */
function AdminViewSwitch() {
  const { viewMode, setViewMode } = useViewMode();
  const [, navigate] = useLocation();

  function go(mode: "admin" | "startup") {
    if (mode === viewMode) return;
    if (!confirmLeave()) return;
    setViewMode(mode);
    navigate(mode === "admin" ? "/admin" : "/");
  }

  return (
    <div className="flex items-center rounded-full border border-slate-200 p-0.5 text-xs font-semibold">
      <button
        onClick={() => go("admin")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${viewMode === "admin" ? "bg-primary text-white" : "text-slate-500 hover:text-primary"}`}
      >
        <ShieldCheck className="h-3.5 w-3.5" /> Admin view
      </button>
      <button
        onClick={() => go("startup")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${viewMode === "startup" ? "bg-secondary text-white" : "text-slate-500 hover:text-primary"}`}
      >
        <Rocket className="h-3.5 w-3.5" /> Startup view
      </button>
    </div>
  );
}

interface StartupLite {
  id: string;
  companyName: string;
  logoUrl?: string | null;
}

interface StartupsResponse {
  startups: StartupLite[];
  activeStartupId: string | null;
}

function StartupAvatar({ startup, size }: { startup: StartupLite | undefined; size: number }) {
  if (startup?.logoUrl) {
    return (
      <img
        src={startup.logoUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded object-contain"
      />
    );
  }
  return <Building2 style={{ width: size * 0.8, height: size * 0.8 }} className="shrink-0 text-secondary" />;
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const { viewMode } = useViewMode();
  const [, navigate] = useLocation();
  const go = (to: string) => { if (confirmLeave()) navigate(to); };
  const qc = useQueryClient();
  // Admins have their own demo startup once they've ever toggled to Startup
  // view, but there's nothing to switch between while looking at the admin
  // console itself — so only show (and fetch) this in Startup view.
  const showStartupSwitcher = user?.role !== "admin" || viewMode === "startup";
  const { data } = useQuery<StartupsResponse>({
    queryKey: ["startups"],
    queryFn: () => api("/api/startups"),
    enabled: showStartupSwitcher,
  });

  const startups = showStartupSwitcher ? data?.startups ?? [] : [];
  const active =
    startups.find((s) => s.id === data?.activeStartupId) ?? startups[0];

  async function switchTo(id: string, close: () => void) {
    close();
    if (id === data?.activeStartupId) return;
    if (!confirmLeave()) return;
    await api(`/api/startups/${id}/activate`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["startups"] });
    qc.invalidateQueries({ queryKey: ["startup-me"] });
    navigate("/");
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        {user?.role === "admin" && <AdminViewSwitch />}
        {startups.length > 0 && (
          <Dropdown
            align="left"
            width="w-64"
            triggerClassName="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-primary hover:border-secondary"
            trigger={
              <>
                <StartupAvatar startup={active} size={20} />
                <span className="max-w-[160px] truncate">
                  {active?.companyName ?? "Select startup"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </>
            }
          >
            {(close) => (
              <>
                <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Your startups
                </p>
                {startups.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => switchTo(s.id, close)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-primary hover:bg-white/60"
                  >
                    <StartupAvatar startup={s} size={28} />
                    <span className="flex-1 truncate">{s.companyName}</span>
                    {s.id === (data?.activeStartupId ?? active?.id) && (
                      <Check className="h-4 w-4 text-secondary" />
                    )}
                  </button>
                ))}
              </>
            )}
          </Dropdown>
        )}
      </div>

      <div className="flex items-center gap-3">
      <Dropdown
        align="right"
        width="w-52"
        triggerClassName="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 hover:border-secondary"
        trigger={
          <>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden text-sm font-medium text-primary sm:inline">
              {user?.name?.split(" ")[0]}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </>
        }
      >
        {(close) => (
          <>
            <div className="px-3 pb-2 pt-1">
              <p className="truncate text-sm font-semibold text-primary">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-slate-200" />
            <button
              onClick={() => { close(); go("/account"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-white/60"
            >
              <Settings className="h-4 w-4 text-slate-400" /> Account settings
            </button>
            <div className="my-1 h-px bg-slate-200" />
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        )}
      </Dropdown>
      </div>
    </header>
  );
}
