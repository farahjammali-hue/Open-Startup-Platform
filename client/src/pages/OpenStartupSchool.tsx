import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/EmptyState";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { showToast } from "../lib/toast";
import { GraduationCap, Lock, CheckCircle2, PlayCircle, ExternalLink, AlertTriangle } from "lucide-react";

interface SchoolTraining {
  id: string;
  module: "expertise" | "immersions" | "alumni";
  title: string;
  description: string | null;
  resourceUrl: string | null;
  status: "locked" | "available" | "in_progress" | "completed";
}

const TABS = ["trainings", "expertise", "immersions", "alumni"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { trainings: "Trainings", expertise: "Expertise", immersions: "Immersions", alumni: "Alumni & Fellows" };
const UNLOCK_COPY: Record<Exclude<Tab, "trainings">, string> = {
  expertise: "Unlocks Month 6 · Curated one-on-one sessions with external practitioners and domain specialists.",
  immersions: "Unlocks Month 8 · Cohort-wide and cross-cohort programming and peer learning events.",
  alumni: "Unlocks at graduation · Access to the broader OST alumni community and ongoing membership.",
};

export default function OpenStartupSchool() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("trainings");
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({});
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ trainings: SchoolTraining[] }>({ queryKey: ["school"], queryFn: () => api("/api/school") });
  const trainings = data?.trainings ?? [];

  async function setStatus(id: string, status: "in_progress" | "completed") {
    try {
      await api(`/api/school/${id}/progress`, { method: "POST", body: JSON.stringify({ status }) });
      qc.invalidateQueries({ queryKey: ["school"] });
    } catch (e: any) {
      showToast(e.message || "Couldn't update this training");
    }
  }

  const foundational = trainings.filter((t) => t.status !== "locked");
  const byModule = (m: Exclude<Tab, "trainings">) => trainings.filter((t) => t.module === m);

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="The learning road" title="Open Startup School" subtitle="Progressive curriculum, timed to your program stage. Nothing is dumped on you at once." />

        <TabBar tabs={TABS.map((t) => ({ key: t, label: TAB_LABELS[t] }))} active={tab} onChange={setTab} />

        {isLoading && (
          <div className="space-y-3">
            <Skeleton tone="dark" className="h-16 rounded-2xl" />
            <Skeleton tone="dark" className="h-16 rounded-2xl" />
            <Skeleton tone="dark" className="h-16 rounded-2xl" />
          </div>
        )}

        {!isLoading && tab === "trainings" && (
          <div className="space-y-3">
            <div className="mb-2 flex items-start gap-4 rounded-lg bg-turq-bg p-4 text-sm text-turq-text">
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
              <div>Foundational course library, available from Day 1. Complete a training to unlock its materials.</div>
            </div>
            {foundational.length === 0 && (
              <EmptyState icon={GraduationCap} title="No trainings available yet" description="Foundational courses will appear here as soon as they're published. Check back soon." />
            )}
            {foundational.map((t) => <TrainingRow key={t.id} training={t} onSetStatus={setStatus} />)}
          </div>
        )}

        {!isLoading && tab !== "trainings" && (
          <div>
            <div className="flex flex-wrap items-start gap-4 rounded-lg bg-amber-bg p-4 text-sm text-amber-text">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">{UNLOCK_COPY[tab]}</div>
              <button onClick={() => setPreviewing((p) => ({ ...p, [tab]: !p[tab] }))} className="ost-btn-ghost !px-3 !py-1.5 text-xs">
                {previewing[tab] ? "Hide preview" : "Preview content"}
              </button>
            </div>
            {previewing[tab] && (
              <div className="mt-6 space-y-3">
                {byModule(tab).length === 0 && (
                  <EmptyState icon={Lock} title="Nothing published for this section yet" description="Content for this stage of the program is still being prepared." />
                )}
                {byModule(tab).map((t) => <TrainingRow key={t.id} training={t} onSetStatus={setStatus} />)}
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function TrainingRow({ training, onSetStatus }: { training: SchoolTraining; onSetStatus: (id: string, status: "in_progress" | "completed") => void }) {
  const locked = training.status === "locked";
  return (
    <div className={`ost-card p-6 ${locked ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-primary">{training.title}</p>
          {training.description && <p className="mt-1 text-sm text-slate-500">{training.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <StatusBadge tone="gray" icon={Lock}>Locked</StatusBadge>
          ) : training.status === "completed" ? (
            <StatusBadge tone="teal" icon={CheckCircle2}>Completed</StatusBadge>
          ) : (
            <>
              {training.resourceUrl && <a href={training.resourceUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-2.5 !py-1.5 text-xs"><ExternalLink className="h-3.5 w-3.5" /> Open</a>}
              {training.status === "available" && <button onClick={() => onSetStatus(training.id, "in_progress")} className="ost-btn-ghost !px-2.5 !py-1.5 text-xs"><PlayCircle className="h-3.5 w-3.5" /> Start</button>}
              <button onClick={() => onSetStatus(training.id, "completed")} className="ost-btn-primary !px-2.5 !py-1.5 text-xs">Mark complete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
