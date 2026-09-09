import { QuarterlySummaryPanel } from "../../components/metrics/QuarterlySummaryPanel";

export function QuarterlyUpdatesTab() {
  return <QuarterlySummaryPanel apiBase="/api/metrics" />;
}
