import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/utils";
import { AuthHeader } from "../components/Brand";
import { Clock } from "@phosphor-icons/react";

/**
 * Terminal screen for onboardingStatus === "pending_approval". Nothing here
 * links anywhere else in the app: there is no further onboarding step, and
 * every other route is gated behind requireAuth on the server too, so this
 * page is the only thing an applicant can do until an admin decides.
 *
 * Deliberately shows only name / email / startup name — the full survey the
 * applicant submitted is reviewed by an admin (in AdminApprovals), not shown
 * back to the applicant here.
 */
export default function PendingApproval() {
  const { user } = useAuth();
  const { data: startup } = useQuery<{ companyName: string } | null>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me").catch(() => null),
  });

  return (
    <div className="ost-shell-bg min-h-screen">
      <AuthHeader withSignOut />

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
          <Clock className="h-8 w-8 text-secondary" />
        </div>
        <h1 className="mt-6 ost-page-title">
          Your application is under review
        </h1>
        <p className="mt-3 ost-page-subtext">
          Thanks, {user?.name?.split(" ")[0]}. The Open Startup team has been
          notified and is reviewing your details. You'll get an email as soon
          as a decision is made, and you can then sign back in here.
        </p>

        <div className="ost-card mt-8 w-full space-y-2 p-5 text-left">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-slate-400">Name</span>
            <span className="font-medium text-primary">{user?.name}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-slate-400">Email</span>
            <span className="font-medium text-primary">{user?.email}</span>
          </div>
          {startup?.companyName && (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-400">Startup</span>
              <span className="font-medium text-primary">{startup.companyName}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
