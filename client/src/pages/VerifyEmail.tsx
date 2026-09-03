import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { BrandPanel, Logo } from "../components/Brand";
import { MailCheck, Loader2, RefreshCw, LogOut } from "lucide-react";

export default function VerifyEmail() {
  const { user, refresh, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-check every few seconds in case they verified in another tab.
  useEffect(() => {
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend() {
    setSending(true);
    setMsg(null);
    try {
      const r = await api<{ emailSent: boolean; alreadyVerified?: boolean }>(
        "/api/auth/resend-verification",
        { method: "POST" },
      );
      if (r.alreadyVerified) {
        await refresh();
      } else if (r.emailSent) {
        setMsg("Sent! Check your inbox (and spam folder).");
      } else {
        setMsg(
          "Email isn't configured yet, so the link was printed in the app's console window.",
        );
      }
    } catch {
      setMsg("Couldn't resend just now. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ost-canvas flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="ost-card w-full max-w-md p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10">
            <MailCheck className="h-7 w-7 text-secondary" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-primary">
            Verify your email
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We sent a verification link to{" "}
            <span className="font-semibold text-primary">{user?.email}</span>.
            Click it to activate your account. This page updates automatically
            once you do.
          </p>

          {msg && (
            <div className="mt-5 rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-secondary-700">
              {msg}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button onClick={resend} className="ost-btn-primary w-full" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend verification email
            </button>
            <button onClick={() => refresh()} className="ost-btn-ghost w-full">
              I've verified — continue
            </button>
          </div>

          <button
            onClick={() => logout()}
            className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-primary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
