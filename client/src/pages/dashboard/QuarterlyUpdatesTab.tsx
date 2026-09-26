import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";
import { NarrativeCheckinCard } from "../../components/dashboard/NarrativeCheckinCard";

export function QuarterlyUpdatesTab({ onSwitchToMonthly }: { onSwitchToMonthly?: () => void }) {
  return (
    <div className="space-y-6">
      <NarrativeCheckinCard />
      <QuarterlySummaryPanel apiBase="/api/metrics" onSwitchToMonthly={onSwitchToMonthly} />
    </div>
  );
}
