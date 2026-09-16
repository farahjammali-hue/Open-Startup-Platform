import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";

export type ViewMode = "admin" | "startup";

const STORAGE_KEY = "ost-admin-view-mode";

interface ViewModeContextValue {
  /** What an admin is currently looking at. Meaningless (always "admin") for non-admins. */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

/**
 * Lets an admin flip between the admin console and a preview of the
 * founder-facing app (App.tsx / Sidebar.tsx read this instead of user.role
 * directly). Only ever relevant for role === "admin"; non-admins always get
 * "admin" back here, which App.tsx/Sidebar.tsx interpret as "use user.role".
 */
export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "startup" ? "startup" : "admin";
    } catch {
      return "admin";
    }
  });

  // Non-admins never get a startup-view toggle stuck on from a previous session.
  useEffect(() => {
    if (user && user.role !== "admin" && viewMode !== "admin") {
      setViewModeState("admin");
    }
  }, [user, viewMode]);

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* best-effort only */
    }
  }

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}

/** The role to actually route/render as, folding in the admin's view toggle. */
export function useEffectiveRole(): "startup" | "mentor" | "investor" | "admin" | null {
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  if (!user) return null;
  if (user.role === "admin" && viewMode === "startup") return "startup";
  return user.role;
}
