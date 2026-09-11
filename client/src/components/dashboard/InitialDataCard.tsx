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
    <div className="ost-card flex flex-col p-5">
      <h3 className="ost-card-title text-sm">{title}</h3>
      <div className="mt-3 flex-1 space-y-2.5 text-sm">{children}</div>
      {hidden && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 flex items-center gap-1 self-start text-xs font-semibold text-secondary hover:underline"
          >
            {isOpen ? "See less" : "See more"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 text-sm">{hidden}</div>}
        </>
      )}
    </div>
  );
}
