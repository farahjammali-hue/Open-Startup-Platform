import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { TrainerAssignment, type TrainerOption } from "../../components/admin/TrainerAssignment";
import { TrainingModuleHomeworkModal, type TrainingModuleHomeworkRow } from "../../components/admin/TrainingModuleHomeworkModal";
import { MENTORSHIP_SESSION_STATUS_TONES } from "../../lib/statusTones";
import { Pencil, Building2, CalendarClock, Paperclip, Presentation } from "lucide-react";

interface StartupBasic {
  id: string;
  companyName: string;
  trainerId: string | null;
}

interface TrainingModuleBasic {
  id: string;
  number: number;
  title: string;
}

interface TargetedSession {
  id: string;
  moduleId: string;
  moduleTitle: string | null;
  number: number;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "upcoming" | "completed";
}

export default function AdminTrainingStartup() {
  const [, params] = useRoute("/admin/training/:startupId");
  const startupId = params?.startupId ?? "";
  const qc = useQueryClient();
  const [homeworkModalModule, setHomeworkModalModule] = useState<{ moduleId: string; moduleNumber: number; moduleTitle: string } | null>(null);

  const { data: startupData, isLoading: startupLoading } = useQuery<{ startup: StartupBasic; trainingHomework: TrainingModuleHomeworkRow[] }>({
    queryKey: ["admin-startup-basic", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}`),
    enabled: !!startupId,
  });

  const { data: trainersData } = useQuery<{ trainers: TrainerOption[] }>({
    queryKey: ["admin-trainers"],
    queryFn: () => api("/api/admin/trainers"),
  });

  const { data: modulesData } = useQuery<{ modules: TrainingModuleBasic[] }>({
    queryKey: ["admin-training-modules-basic"],
    queryFn: () => api("/api/admin/training/modules"),
  });
  const modules = modulesData?.modules ?? [];

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: TargetedSession[] }>({
    queryKey: ["admin-training-sessions", startupId],
    queryFn: () => api(`/api/admin/startups/${startupId}/training-sessions`),
    enabled: !!startupId,
  });
  const sessions = sessionsData?.sessions ?? [];

  if (startupLoading || !startupData) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to="/admin/training" label="Back to Training" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const startup = startupData.startup;
  const homeworkByModuleId = new Map(startupData.trainingHomework.map((h) => [h.moduleId, h]));

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin/training" label="Back to Training" />
        <PageHeader
          eyebrow="Administration · Training"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Manage this startup's trainer, homework, and see which sessions apply to them."
        />

        <div className="ost-card mt-8 p-6">
          <h2 className="ost-card-title mb-4 text-base">Trainer</h2>
          <TrainerAssignment
            startupId={startupId}
            currentTrainerId={startup.trainerId}
            trainers={trainersData?.trainers ?? []}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] })}
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Homework</h2>
        </div>
        {modules.length === 0 ? (
          <EmptyState icon={Paperclip} title="No modules yet" description="Add a training module first." />
        ) : (
          <div className="mt-3 space-y-2">
            {modules.map((m) => {
              const h = homeworkByModuleId.get(m.id) ?? null;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary">Module {m.number} · {m.title}</div>
                    {h?.submissionFileUrl && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Paperclip className="h-3 w-3" /> Submitted: {h.submissionFileName ?? "file"}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={h?.homeworkUrl ? "teal" : "gray"}>{h?.homeworkUrl ? "Assigned" : "Not assigned"}</StatusBadge>
                    <button
                      onClick={() => setHomeworkModalModule({ moduleId: m.id, moduleNumber: m.number, moduleTitle: m.title })}
                      className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit homework
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Sessions targeting this startup</h2>
          <Link href="/admin/training" className="text-xs font-semibold text-secondary hover:underline">Edit sessions in Training →</Link>
        </div>
        {sessionsLoading ? null : sessions.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No sessions yet" description="Sessions are created and targeted to startups from the Training admin page." />
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-offwhite px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Presentation className="h-3.5 w-3.5 text-secondary" />
                    <p className="text-sm font-semibold text-primary">{s.moduleTitle ? `${s.moduleTitle} · ` : ""}Session {s.number} · {s.title}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                    <span>{s.durationMinutes} min</span>
                  </div>
                </div>
                <StatusBadge tone={MENTORSHIP_SESSION_STATUS_TONES[s.status]}>{s.status}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </main>

      {homeworkModalModule && (
        <TrainingModuleHomeworkModal
          startupId={startupId}
          moduleId={homeworkModalModule.moduleId}
          title={`Module ${homeworkModalModule.moduleNumber} · ${homeworkModalModule.moduleTitle}`}
          homework={homeworkByModuleId.get(homeworkModalModule.moduleId) ?? null}
          onClose={() => setHomeworkModalModule(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-startup-basic", startupId] })}
        />
      )}
    </AppShell>
  );
}
