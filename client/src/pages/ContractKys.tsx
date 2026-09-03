import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader } from "../components/PageHeader";
import { useKysStatus } from "../lib/kysStatus";
import { ContractStep } from "./contract-kys/ContractStep";
import { KysStep } from "./contract-kys/KysStep";
import { DoneStep } from "./contract-kys/DoneStep";
import { Check } from "lucide-react";
import { Skeleton } from "../components/Skeleton";

type Step = "contract" | "kys" | "done";

export default function ContractKys() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { contract, kysProfile, contractSigned, kysSubmitted, kysDocuments, isLoading } = useKysStatus();
  const { data: startup } = useQuery<{ companyName: string }>({
    queryKey: ["startup-me"],
    queryFn: () => api("/api/startup/me"),
  });

  const [step, setStep] = useState<Step | null>(null);
  useEffect(() => {
    if (isLoading || step !== null) return;
    setStep(kysSubmitted ? "done" : contractSigned ? "kys" : "contract");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

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
            subtitle={step !== "done" ? "Sign your program agreement and complete your Know Your Startup profile. Both are required to unlock your Dashboard." : undefined}
          />

          {step !== "done" && (
            <div className="mb-8 mt-8 flex gap-4 border-b border-white/10">
              <StepTab label="Contract" num={1} active={step === "contract"} done={contractSigned} onClick={() => setStep("contract")} />
              <StepTab label="Know Your Startup (KYS)" num={2} active={step === "kys"} done={kysSubmitted} onClick={() => contractSigned && setStep("kys")} />
            </div>
          )}

          {step === "contract" && (
            <ContractStep
              initial={contract}
              onSigned={() => {
                qc.invalidateQueries({ queryKey: ["contract"] });
                setStep(kysSubmitted ? "done" : "kys");
              }}
            />
          )}
          {step === "kys" && (
            <KysStep
              initial={kysProfile}
              defaultStartupName={startup?.companyName ?? ""}
              documents={kysDocuments}
              onSubmitted={() => {
                qc.invalidateQueries({ queryKey: ["kys"] });
                setStep("done");
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
        active ? "border-secondary text-secondary-300" : "border-transparent text-white/50 hover:text-white"
      }`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-secondary text-white" : active ? "bg-secondary text-white" : "bg-white/10 text-white/40"}`}>
        {done ? <Check className="h-3 w-3" /> : num}
      </span>
      {label}
    </button>
  );
}
