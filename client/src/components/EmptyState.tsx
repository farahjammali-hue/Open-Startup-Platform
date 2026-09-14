import type { Icon } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon: Icon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Polished empty state for lists/panels with nothing in them yet: icon, copy, and an optional primary CTA. */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="ost-card flex flex-col items-center gap-4 px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="ost-card-title">{title}</h3>
        <p className="mx-auto max-w-[420px] text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="ost-btn-primary mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
