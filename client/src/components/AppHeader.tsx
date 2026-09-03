import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { confirmLeave } from "../lib/navGuard";
import { Dropdown } from "./Dropdown";
import { ThemeToggle } from "./ThemeToggle";
import {
  ChevronDown,
  Plus,
  Check,
  Building2,
  LogOut,
  Settings,
} from "lucide-react";

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
  const [, navigate] = useLocation();
  const go = (to: string) => { if (confirmLeave()) navigate(to); };
  const qc = useQueryClient();
  const { data } = useQuery<StartupsResponse>({
    queryKey: ["startups"],
    queryFn: () => api("/api/startups"),
  });

  const startups = data?.startups ?? [];
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
    <header className="flex items-center justify-between border-b border-white/10 bg-primary/40 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-4">
        {startups.length > 0 && (
          <Dropdown
            align="left"
            width="w-64"
            triggerClassName="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:border-secondary"
            trigger={
              <>
                <StartupAvatar startup={active} size={20} />
                <span className="max-w-[160px] truncate">
                  {active?.companyName ?? "Select startup"}
                </span>
                <ChevronDown className="h-4 w-4 text-white/40" />
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
                <div className="my-1 h-px bg-slate-200" />
                {startups.length < 2 && (
                  <button
                    onClick={() => { close(); go("/startups/new"); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-secondary hover:bg-white/60"
                  >
                    <Plus className="h-4 w-4" /> Create new startup
                  </button>
                )}
              </>
            )}
          </Dropdown>
        )}
      </div>

      <div className="flex items-center gap-3">
      <ThemeToggle />
      <Dropdown
        align="right"
        width="w-52"
        triggerClassName="flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3 hover:border-secondary"
        trigger={
          <>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden text-sm font-medium text-white sm:inline">
              {user?.name?.split(" ")[0]}
            </span>
            <ChevronDown className="h-4 w-4 text-white/40" />
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
            <button
              onClick={() => { close(); go("/account#startups"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-white/60"
            >
              <Building2 className="h-4 w-4 text-slate-400" /> My startups
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
