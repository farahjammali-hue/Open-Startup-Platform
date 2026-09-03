import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { ToastHost } from "../lib/toast";

/** Standard page frame: left module sidebar + top bar + content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="ost-canvas flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        {children}
      </div>
      <ToastHost />
    </div>
  );
}
