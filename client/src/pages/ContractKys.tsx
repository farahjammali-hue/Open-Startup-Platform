import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader } from "../components/PageHeader";
import { useKysStatus } from "../lib/kysStatus";
import { ContractStep } from "./contract-kys/ContractStep";
import { KysStep } from "./contract-kys/KysStep";
import { DoneStep } from "./contract-kys/DoneStep";
import { Check } from "@phosphor-icons/react";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { FileText } from "@phosphor-icons/react";
import { api } from "../lib/utils";

type Step = "contract" | "kys" | "done";

export default function ContractKys() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { contract, kysProfile, contractSigned, kysSubmitted, isLoading } = useKysStatus();
  // Contract & KYS are per startup; reached by URL with no startup, point
  // the founder at creating one instead of showing a form that can't save.
  const { isError: noStartup } = useQuery({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
    retryOnMount: false,
  });

  const [step, setStep] = useState<Step | null>(null);
  useEffect(() => {
    if (isLoading || step !== null) return;
    setStep(!kysSubmitted ? "kys" : contractSigned ? "done" : "contract");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (noStartup) {
    return (
      <AppShell>
        <main className="ost-page">
          <EmptyState
            icon={FileText}
            title="Create your startup first"
            description="Your contract and KYS are tied to a startup. Create your startup profile, then come back here to complete them."
            actionLabel="Create your startup"
            onAction={() => navigate("/startups/new")}
          />
        </main>
      </AppShell>
    );
  }

  if (step === null) {
    return (
      <AppShell>
        <main className="ost-page">
          <div className="max-w-[720px] space-y-4">
            <Skeleton tone="dark" className="h-8 w-2/3 rounded-lg" />
            <Skeleton tone="dark" className="h-64 rounded-2xl" />
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="ost-page">
        <div className="max-w-[720px]">
          <BackLink />
          <PageHeader
            eyebrow="Priority"
            title="Contract & KYS"
            subtitle={step !== "done" ? "Complete your Know Your Startup (KYS) form, then sign your program agreement. Both are required to unlock your Dashboard." : undefined}
          />

          {step !== "done" && (
            <div className="mb-8 mt-8 flex gap-4 border-b border-slate-200">
              <StepTab label="Know Your Startup (KYS)" num={1} active={step === "kys"} done={kysSubmitted} onClick={() => setStep("kys")} />
              <StepTab label="Contract" num={2} active={step === "contract"} done={contractSigned} onClick={() => kysSubmitted && setStep("contract")} />
            </div>
          )}

          {step === "contract" && (
            <ContractStep
              initial={contract}
              onSigned={() => {
                qc.invalidateQueries({ queryKey: ["contract"] });
                setStep("done");
              }}
            />
          )}
          {step === "kys" && (
            <KysStep
              initial={kysProfile}
              onSubmitted={() => {
                qc.invalidateQueries({ queryKey: ["kys"] });
                setStep(contractSigned ? "done" : "contract");
              }}
            />
          )}
          {step === "done" && (
            <DoneStep
              contract={contract}
              kysProfile={kysProfile}
              onGoToDashboard={() => navigate("/dashboard")}
              onEditContract={() => setStep("contract")}
              onEditKys={() => setStep("kys")}
            />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function StepTab({ label, num, active, done, onClick }: { label: string; num: number; active: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-1 pb-4 pt-2 text-sm font-semibold transition ${
        active ? "border-secondary text-secondary" : "border-transparent text-slate-400 hover:text-primary"
      }`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-secondary text-white" : active ? "bg-secondary text-white" : "bg-slate-100 text-slate-400"}`}>
        {done ? <Check className="h-4 w-4" /> : num}
      </span>
      {label}
    </button>
  );
}
