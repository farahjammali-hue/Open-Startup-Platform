import { MetricsKpiPanel } from "../../components/metrics/MetricsKpiPanel";
import { MetricsChartsPanel } from "../../components/metrics/MetricsChartsPanel";

export function MetricsKpiTab() {
  return (
    <div className="space-y-6">
      <MetricsChartsPanel apiBase="/api/metrics" />
      <MetricsKpiPanel apiBase="/api/metrics" />
    </div>
  );
}
