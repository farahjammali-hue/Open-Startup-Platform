import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/utils";
import { OnboardingShell } from "../../components/OnboardingShell";
import { StartupForm, type StartupFormInitial } from "../../components/StartupForm";
import { SkeletonText } from "../../components/Skeleton";

export default function StartupSurvey() {
  const { refresh } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  // The startup was created in the basics step; load it so logo/deck uploads
  // have an id and the form can prefill (e.g. website).
  const { data: me, isLoading } = useQuery<StartupFormInitial & { id: string }>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
  });

  async function handleSubmit(payload: any) {
    setServerError(null);
    try {
      await api("/api/startup/survey", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh(); // onboardingStatus -> complete; App routes to dashboard
    } catch (err: any) {
      setServerError(err.message || "Couldn't submit survey");
      throw err;
    }
  }

  return (
    <OnboardingShell
      step={3}
      title="Your startup profile"
      subtitle="Fill in the details below. Fields marked * are required. You can edit any of this later."
    >
      {isLoading || !me ? (
        <SkeletonText lines={5} />
      ) : (
        <StartupForm
          initial={me}
          startupId={me.id}
          submitLabel="Finish & go to dashboard"
          onSubmit={handleSubmit}
          serverError={serverError}
        />
      )}
    </OnboardingShell>
  );
}
