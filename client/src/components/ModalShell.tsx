import type { ReactNode } from "react";

/**
 * Shared centered-modal backdrop + panel used by every confirm dialog and review modal.
 * Pass `title` (and optionally `onClose`) for the header+Close-button row used by review
 * modals; omit both to get a bare panel for modals that build their own heading and
 * footer buttons (confirm dialogs).
 */
export function ModalShell({
  title,
  subtitle,
  onClose,
  maxWidth = "max-w-xl",
  scrollable = true,
  children,
}: {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  maxWidth?: string;
  scrollable?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`fixed inset-0 z-30 flex items-center justify-center bg-primary/40 px-4 ${scrollable ? "py-8" : ""}`}>
      <div className={`w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-card-hover ${scrollable ? "max-h-full overflow-y-auto" : ""}`}>
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-primary">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
            {onClose && (
              <button onClick={onClose} className="ost-btn-ghost !px-2.5 !py-1.5 text-xs">Close</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
