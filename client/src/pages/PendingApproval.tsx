import { useAuth } from "../lib/auth";
import { AuthHeader } from "../components/Brand";
import { Clock } from "@phosphor-icons/react";

/**
 * Terminal screen for onboardingStatus === "pending_approval". Nothing here
 * links anywhere else in the app: there is no further onboarding step, and
 * every other route is gated behind requireAuth on the server too, so this
 * page is the only thing an applicant can do until an admin decides.
 */
export default function PendingApproval() {
  const { user } = useAuth();

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
      </main>
    </div>
  );
}
