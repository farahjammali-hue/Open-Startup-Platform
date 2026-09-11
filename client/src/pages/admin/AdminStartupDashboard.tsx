import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import {
  GOAL_STATUS_LABELS, GOAL_STATUS_TONES,
  type Goal, type TeamMemberRow, type CapTableEntryRow,
} from "../dashboard/types";
import { MetricsKpiPanel } from "../../components/metrics/MetricsKpiPanel";
import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";
import { LEGAL_ENTITY_LABELS, BUSINESS_MODEL_LABELS, CUSTOMER_BASE_LABELS } from "../../lib/startupProfileLabels";
import { formatMoney } from "../../lib/format";
import {
  Building2, Users, Target, Inbox, ExternalLink,
  Briefcase, Cpu, TrendingUp, Handshake, Globe2, PieChart,
} from "lucide-react";

interface StartupProfileBasic {
  id: string; companyName: string;
  legalEntityStatus: string | null; startedYear: number | null; country: string | null;
  businessModelType: string | null; deckUrl: string | null;
  coreBusinessOverview: string | null; coreIpTechnology: string | null;
  totalRevenueSinceFounding: number | null; amountRaised: number | null; totalGrants: number | null;
  totalRoundSize: number | null; roundTerms: string | null; lastValuation: number | null;
  sdgsAddressed: string[] | null; femaleTeamMembers: number | null; youthEmployees: number | null;
  countryOfIncorporation: string | null; customerBase: string | null; countriesOfOperation: string | null;
}

interface Detail {
  startup: StartupProfileBasic;
  goals: Goal[];
  teamMembers: TeamMemberRow[];
  capTableEntries: CapTableEntryRow[];
}

export default function AdminStartupDashboard() {
  const [, params] = useRoute("/admin/startups/:id/dashboard");
  const id = params?.id ?? "";
  const [tab, setTab] = useState<"initial" | "monthly" | "quarterly">("initial");

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["admin-startup-detail", id],
    queryFn: () => api(`/api/admin/startups/${id}`),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <main className="ost-page">
          <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
          <div className="mt-6 flex items-center gap-3">
            <Skeleton tone="dark" className="h-11 w-11 rounded-xl" />
            <SkeletonText tone="dark" lines={2} className="max-w-xs" />
          </div>
        </main>
      </AppShell>
    );
  }

  const { startup, goals, teamMembers, capTableEntries } = data;
  const capTableTotal = capTableEntries.reduce((sum, e) => sum + e.percentage, 0);

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to={`/admin/startups/${id}`} label="Back to startup" />
        <PageHeader
          eyebrow="Administration · Dashboard"
          title={
            <span className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" /> {startup.companyName}
            </span>
          }
          subtitle="Initial data, monthly metrics, and quarterly updates."
        />

        <TabBar
          tabs={[
            { key: "initial", label: "Initial Data" },
            { key: "monthly", label: "Monthly Updates" },
            { key: "quarterly", label: "Quarterly Updates" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "initial" && (
          <>
            <Section title="Startup Profile" icon={Building2}>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Profile</h4>
                  <Field label="Legal Entity" value={startup.legalEntityStatus ? LEGAL_ENTITY_LABELS[startup.legalEntityStatus] : null} />
                  <Field label="Year of constitution" value={startup.startedYear ? String(startup.startedYear) : null} />
                  <Field label="Country" value={startup.country} />
                  <Field label="Business Model Type" value={startup.businessModelType ? BUSINESS_MODEL_LABELS[startup.businessModelType] : null} />
                  <LinkField label="Deck link" url={startup.deckUrl} />
                </div>
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Briefcase className="h-3.5 w-3.5" /> Core Business</h4>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{startup.coreBusinessOverview || <span className="text-slate-300">Not added yet.</span>}</p>
                </div>
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Cpu className="h-3.5 w-3.5" /> Core IP / Technology</h4>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{startup.coreIpTechnology || <span className="text-slate-300">Not added yet.</span>}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><TrendingUp className="h-3.5 w-3.5" /> Traction &amp; previous funding</h4>
                  <Field label="Total revenues since founding year" value={formatMoney(startup.totalRevenueSinceFounding)} />
                  <Field label="Total investments raised" value={formatMoney(startup.amountRaised)} />
                  <Field label="Total Grants" value={formatMoney(startup.totalGrants)} />
                </div>
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Handshake className="h-3.5 w-3.5" /> Round Details</h4>
                  <Field label="Total Round Size" value={formatMoney(startup.totalRoundSize)} />
                  <Field label="Round terms" value={startup.roundTerms} />
                  <Field label="Last Valuation" value={formatMoney(startup.lastValuation)} />
                </div>
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Globe2 className="h-3.5 w-3.5" /> Impact Metrics</h4>
                  <Field label="SDGs Addressed" value={startup.sdgsAddressed && startup.sdgsAddressed.length > 0 ? startup.sdgsAddressed.join(", ") : null} />
                  <Field label="Female team members" value={startup.femaleTeamMembers != null ? String(startup.femaleTeamMembers) : null} />
                  <Field label="Youth employees" value={startup.youthEmployees != null ? String(startup.youthEmployees) : null} />
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Globe2 className="h-3.5 w-3.5" /> Markets</h4>
                  <Field label="Country of Incorporation" value={startup.countryOfIncorporation} />
                  <Field label="Customer Base" value={startup.customerBase ? CUSTOMER_BASE_LABELS[startup.customerBase] : null} />
                  <Field label="Countries of Operation" value={startup.countriesOfOperation} />
                </div>
              </div>
            </Section>

            <Section title="Cap Table" icon={PieChart}>
              {capTableEntries.length === 0 ? <EmptyRow text="No cap table entries yet." /> : (
                <div>
                  {capTableEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                      <span className="truncate text-sm font-semibold text-primary">{entry.name}</span>
                      <span className="text-sm font-semibold text-slate-600">{entry.percentage}%</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</span>
                    <span className="text-sm font-extrabold text-primary">{capTableTotal}%</span>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Team" icon={Users}>
              {teamMembers.length === 0 ? <EmptyRow text="No team members added yet." /> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamMembers.map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-100 px-4 py-3">
                      <div className="text-sm font-semibold text-primary">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.role || "—"} · {m.type.replace("_", " ")}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Objectives" icon={Target}>
              {goals.length === 0 ? <EmptyRow text="No objectives set yet." /> : (
                <div className="space-y-2">
                  {goals.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{g.title}</div>
                        {g.targetDate && <div className="text-xs text-slate-400">Target: {new Date(g.targetDate).toLocaleDateString()}</div>}
                      </div>
                      <StatusBadge tone={GOAL_STATUS_TONES[g.status]}>{GOAL_STATUS_LABELS[g.status]}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === "monthly" && (
          <Section title="Metrics & KPIs" icon={TrendingUp}>
            <MetricsKpiPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={data.startup.companyName} />
          </Section>
        )}

        {tab === "quarterly" && (
          <Section title="Quarterly updates" icon={PieChart}>
            <QuarterlySummaryPanel apiBase={`/api/admin/startups/${id}/metrics`} startupName={data.startup.companyName} />
          </Section>
        )}
      </main>
    </AppShell>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="ost-card mt-8 p-6">
      <h2 className="ost-card-title mb-4 flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-secondary" /> {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
      <Inbox className="h-4 w-4" /> {text}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="ost-helper-text">{label}</span>
      <span className="truncate text-sm font-semibold text-primary">{value || "—"}</span>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="ost-helper-text">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline">
          View <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm font-semibold text-slate-300">—</span>
      )}
    </div>
  );
}
