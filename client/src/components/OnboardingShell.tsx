import type { ReactNode } from "react";
import { AuthHeader } from "./Brand";
import { Check } from "@phosphor-icons/react";

const STEPS = ["Role", "Basics", "Survey"] as const;

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="ost-shell-bg min-h-screen">
      <AuthHeader withSignOut />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const done = n < step;
            const active = n === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-secondary text-white"
                      : active
                        ? "border-2 border-secondary text-secondary"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : n}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-primary" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
                {n < 3 && <span className="mx-1 h-px w-6 bg-slate-200" />}
              </li>
            );
          })}
        </ol>

        <div className="ost-card p-8">
          <h1 className="text-2xl font-extrabold text-primary">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
