import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { BackLink, PageHeader, TabBar } from "../components/PageHeader";
import { OverviewTab } from "./dashboard/OverviewTab";
import { MetricsKpiTab } from "./dashboard/MetricsKpiTab";
import { QuarterlyUpdatesTab } from "./dashboard/QuarterlyUpdatesTab";

const TABS = [
  { key: "overview", label: "Initial Data" },
  { key: "metrics", label: "Monthly Updates" },
  { key: "monthly", label: "Quarterly Updates" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function StartupDashboard() {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink />
        <PageHeader eyebrow="Priority" title="Dashboard" subtitle="Your operational workspace · reporting, metrics, and team management" />

        <TabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "overview" && <OverviewTab />}
        {tab === "metrics" && <MetricsKpiTab />}
        {tab === "monthly" && <QuarterlyUpdatesTab />}
      </main>
    </AppShell>
  );
}
