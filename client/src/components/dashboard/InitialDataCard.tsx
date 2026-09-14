import type { ReactNode } from "react";
import { CaretDown as ChevronDown, Check, type Icon } from "@phosphor-icons/react";

export type CardCompletion = "empty" | "partial" | "complete";

function CompletionBadge({ status }: { status: CardCompletion }) {
  if (status === "empty") return null;
  if (status === "complete") {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--green)" }}
        title="Complete"
        aria-label="Complete"
      >
        <Check className="h-3 w-3" weight="bold" style={{ color: "var(--navy)" }} />
      </span>
    );
  }
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: "var(--yellow)" }}
      title="Partly filled"
      aria-label="Partly filled"
    />
  );
}

/** One of the 15 Initial Data cards: a header (number + title, optional icon, completion badge), a visible face, and an optional "See more" disclosure. */
export function InitialDataCard({
  title,
  icon: CardIcon,
  completion = "empty",
  children,
  hidden,
  isOpen,
  onToggle,
}: {
  title: string;
  icon?: Icon;
  completion?: CardCompletion;
  children: ReactNode;
  hidden?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [number, ...rest] = title.split(". ");
  const label = rest.join(". ") || title;

  return (
    <div className="ost-card flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--text-1)" }}>
          {CardIcon && <CardIcon className="h-5 w-5 shrink-0" style={{ color: "var(--info)" }} />}
          <span>
            <span style={{ color: "var(--text-3)" }}>{number}.</span> {label}
          </span>
        </h3>
        <CompletionBadge status={completion} />
      </div>

      <div className="mt-4 flex-1 space-y-4 text-sm">{children}</div>

      {hidden && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="mt-4 flex items-center gap-1 self-start text-xs font-semibold text-secondary hover:underline"
          >
            {isOpen ? "See less" : "See more"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && <div className="mt-4 space-y-4 border-t pt-4 text-sm" style={{ borderColor: "var(--border)" }}>{hidden}</div>}
        </>
      )}
    </div>
  );
}
