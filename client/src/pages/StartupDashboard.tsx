import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { OverviewTab } from "./dashboard/OverviewTab";
import { KpiPanel } from "./dashboard/KpiPanel";
import { MonthlyUpdatesTab } from "./dashboard/MonthlyUpdatesTab";
import { TeamTab } from "./dashboard/TeamTab";
import type { KpiSubmission, MonthlyUpdateRow, TeamMemberRow, CapTableEntryRow } from "./dashboard/types";

export interface StartupProfile {
  id: string;
  companyName: string;
  website: string | null;
  shortDescription: string | null;
  location: string | null;
  stage: string | null;
  isIncorporated: boolean | null;
  startedMonth: number | null;
  startedYear: number | null;
  amountRaised: number | null;
  deckUrl: string | null;
  legalEntityStatus: "yes" | "in_process" | "no" | null;
  country: string | null;
  businessModelType: "b2b" | "b2c" | "b2b2c" | null;
  dataRoomLink: string | null;
  coreBusinessOverview: string | null;
  coreIpTechnology: string | null;
  totalRevenueSinceFounding: number | null;
  totalGrants: number | null;
  totalRoundSize: number | null;
  roundTerms: string | null;
  lastValuation: number | null;
  sdgsAddressed: string[] | null;
  femaleTeamMembers: number | null;
  youthEmployees: number | null;
  countryOfIncorporation: string | null;
  customerBase: "low" | "moderate" | "high" | "emerging_market" | "saturated_market" | null;
  countriesOfOperation: string | null;
  techTrack: "deep_tech" | "soft_tech" | null;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "kpi", label: "KPI collection" },
  { key: "monthly", label: "Monthly updates" },
  { key: "team", label: "Team" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function StartupDashboard() {
  const [tab, setTab] = useState<TabKey>("overview");

  const { data: startup } = useQuery<StartupProfile>({ queryKey: ["startup-me"], queryFn: () => api("/api/startup/me") });
  const { data: kpiData } = useQuery<{ submissions: KpiSubmission[] }>({ queryKey: ["kpis"], queryFn: () => api("/api/kpis") });
  const { data: monthlyData } = useQuery<{ updates: MonthlyUpdateRow[] }>({ queryKey: ["monthly-updates"], queryFn: () => api("/api/monthly-updates") });
  const { data: teamData } = useQuery<{ members: TeamMemberRow[] }>({ queryKey: ["team"], queryFn: () => api("/api/team") });
  const { data: capTableData } = useQuery<{ entries: CapTableEntryRow[] }>({ queryKey: ["cap-table"], queryFn: () => api("/api/cap-table") });
  const submissions = kpiData?.submissions ?? [];
  const monthlyUpdates = monthlyData?.updates ?? [];
  const team = teamData?.members ?? [];
  const capTable = capTableData?.entries ?? [];

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Priority" title="Dashboard" subtitle="Your operational workspace · reporting, metrics, and team management" />

        <TabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "overview" && <OverviewTab startup={startup ?? null} team={team} capTable={capTable} />}
        {tab === "kpi" && <KpiPanel submissions={submissions} startup={startup ?? null} />}
        {tab === "monthly" && <MonthlyUpdatesTab updates={monthlyUpdates} />}
        {tab === "team" && <TeamTab team={team} />}
      </main>
    </AppShell>
  );
}
