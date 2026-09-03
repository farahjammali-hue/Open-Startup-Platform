import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

/** The "← Back to Home" link repeated at the top of every module page. */
export function BackLink({ to = "/", label = "Back to Home", onClick }: { to?: string; label?: string; onClick?: () => void }) {
  const [, navigate] = useLocation();
  return (
    <button onClick={onClick ?? (() => navigate(to))} className="mb-4 flex items-center gap-2 text-sm font-medium ost-back-link">
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

/** Eyebrow + title + subtext, the standard header block for every module page. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={action ? "flex items-start justify-between gap-4" : undefined}>
      <div>
        <span className="ost-eyebrow">{eyebrow}</span>
        <h1 className="mt-2 ost-page-title">{title}</h1>
        {subtitle && <p className="mt-2 ost-page-subtext">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** The underlined tab row used by every multi-tab module page. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-8 mt-8 flex flex-wrap gap-2 border-b border-white/10">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
            active === t.key ? "border-secondary text-secondary-300" : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
