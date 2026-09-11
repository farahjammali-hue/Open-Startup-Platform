import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** One of the 15 Initial Data cards: a visible face, and an optional "See more" hidden section. */
export function InitialDataCard({
  title,
  children,
  hidden,
  isOpen,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  hidden?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ost-card p-4">
      <h3 className="ost-card-title text-sm">{title}</h3>
      <div className="mt-2.5 space-y-2 text-sm">{children}</div>
      {hidden && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
          >
            {isOpen ? "See less" : "See more"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 text-sm">{hidden}</div>}
        </>
      )}
    </div>
  );
}
