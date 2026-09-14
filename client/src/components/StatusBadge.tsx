import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export const TONE_CLASSES = {
  teal: "bg-turq-bg text-turq-text",
  amber: "bg-amber-bg text-amber-text",
  red: "bg-red-50 text-red-600",
  gray: "bg-slate-100 text-slate-600",
  primary: "bg-primary/10 text-primary",
} as const;

export type StatusTone = keyof typeof TONE_CLASSES;

/** Small pill used for every status/state indicator (documents, sessions, goals, bookings). */
export function StatusBadge({ tone, icon: Icon, children }: { tone: StatusTone; icon?: Icon; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {Icon && <Icon className="h-4 w-4" />} {children}
    </span>
  );
}
