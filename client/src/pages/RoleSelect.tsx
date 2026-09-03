import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { Logo } from "../components/Brand";
import { Rocket, Users, LineChart, Lock, Loader2, LogOut } from "lucide-react";

const ROLES = [
  {
    id: "startup",
    label: "Startup",
    icon: Rocket,
    available: true,
    blurb: "Join a program, meet mentors, track progress, and build your data room.",
  },
  {
    id: "mentor",
    label: "Mentor / Coach",
    icon: Users,
    available: false,
    blurb: "Guide startups, run office hours, and log session feedback.",
  },
  {
    id: "investor",
    label: "Investor",
    icon: LineChart,
    available: false,
    blurb: "Explore the deal pipeline and access curated data rooms.",
  },
] as const;

export default function RoleSelect() {
  const { user, refresh, logout } = useAuth();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(role: string, available: boolean) {
    if (!available) return;
    setError(null);
    setBusy(true);
    try {
      await api("/api/onboarding/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      await refresh();
      navigate("/onboarding/basics");
    } catch (err: any) {
      setError(err.message || "Couldn't set role");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ost-canvas min-h-screen">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Logo className="[&_*]:text-white" />
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-secondary-300">
          Welcome, {user?.name?.split(" ")[0]}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold ost-page-title">
          How will you be using the platform?
        </h1>
        <p className="mt-2 max-w-xl text-sm ost-page-subtext">
          Pick the role that fits you. You can only set this once for now —
          more roles are coming soon.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => choose(r.id, r.available)}
                disabled={!r.available || busy}
                className={`group relative flex flex-col items-start rounded-2xl border p-6 text-left transition ${
                  r.available
                    ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-secondary hover:shadow-card-hover"
                    : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50"
                }`}
              >
                {!r.available && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <Lock className="h-3 w-3" /> Soon
                  </span>
                )}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    r.available
                      ? "bg-secondary/10 text-secondary"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-primary">
                  {r.label}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{r.blurb}</p>
                {r.available && (
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Continue →"
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
