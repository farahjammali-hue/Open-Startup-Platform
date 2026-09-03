import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink } from "../components/PageHeader";
import { StartupForm, type StartupFormInitial } from "../components/StartupForm";
import { Skeleton } from "../components/Skeleton";
import { confirmLeave, setNavDirty } from "../lib/navGuard";

export default function EditStartup() {
  const [, params] = useRoute("/startups/:id/edit");
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const id = params?.id;
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: startup, isLoading } = useQuery<StartupFormInitial & { companyName: string }>({
    queryKey: ["startup", id],
    queryFn: () => api(`/api/startups/${id}`),
    enabled: !!id,
  });

  async function handleSubmit(payload: any) {
    setServerError(null);
    try {
      await api(`/api/startups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      qc.invalidateQueries({ queryKey: ["startup-me"] });
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["startup", id] });
      navigate("/");
    } catch (err: any) {
      setServerError(err.message || "Couldn't save changes");
      throw err;
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink onClick={() => { if (confirmLeave()) navigate("/"); }} />

        <div className="ost-card max-w-[720px] p-8">
          {isLoading ? (
            <Skeleton className="h-7 w-56" />
          ) : (
            <h1 className="ost-card-title text-xl">Edit {startup?.companyName ?? "startup"}</h1>
          )}
          <p className="mt-2 ost-card-subtext">
            Update your profile. Fields marked * are required.
          </p>

          <div className="mt-6">
            {!isLoading && startup && (
              <StartupForm
                initial={startup}
                submitLabel="Save changes"
                onSubmit={handleSubmit}
                onDiscard={() => { setNavDirty(false); navigate("/"); }}
                serverError={serverError}
                startupId={id}
              />
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
