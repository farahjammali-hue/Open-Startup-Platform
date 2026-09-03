import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Trigger + panel dropdown with click-outside-to-close, shared by every
 * menu in AppHeader (startup switcher, account menu). `children` is a
 * render-prop receiving `close` so panel items can dismiss the dropdown
 * before navigating or mutating.
 */
export function Dropdown({
  trigger,
  triggerClassName,
  align = "left",
  width = "w-64",
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} z-20 mt-2 ${width} rounded-xl border border-slate-100 bg-offwhite py-2 shadow-card-hover`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
