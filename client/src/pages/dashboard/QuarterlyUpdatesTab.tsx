import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";

export function QuarterlyUpdatesTab({ onSwitchToMonthly }: { onSwitchToMonthly?: () => void }) {
  return <QuarterlySummaryPanel apiBase="/api/metrics" onSwitchToMonthly={onSwitchToMonthly} />;
}
