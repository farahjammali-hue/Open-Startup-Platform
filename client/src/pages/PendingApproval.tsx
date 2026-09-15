import { useAuth } from "../lib/auth";
import { Logo } from "../components/Brand";
import { Clock, SignOut as LogOut } from "@phosphor-icons/react";

/**
 * Terminal screen for onboardingStatus === "pending_approval". Nothing here
 * links anywhere else in the app: there is no further onboarding step, and
 * every other route is gated behind requireAuth on the server too, so this
 * page is the only thing an applicant can do until an admin decides.
 */
export default function PendingApproval() {
  const { user, logout } = useAuth();

  return (
    <div className="ost-canvas min-h-screen">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Logo className="[&_*]:text-white" />
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Clock className="h-8 w-8 text-secondary-300" />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-white">
          Your application is under review
        </h1>
        <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-white/70">
          Thanks, {user?.name?.split(" ")[0]}. The Open Startup team has been
          notified and is reviewing your details. You'll get an email as soon
          as a decision is made, and you can then sign back in here.
        </p>
      </main>
    </div>
  );
}
