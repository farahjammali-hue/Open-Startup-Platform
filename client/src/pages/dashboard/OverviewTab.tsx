import { InitialDataPanel, type InitialDataApiConfig } from "../../components/dashboard/InitialDataPanel";

const FOUNDER_CONFIG: InitialDataApiConfig = {
  getUrl: "/api/startup-profile",
  overviewPatchUrl: "/api/startup-profile/overview",
  teamUrl: "/api/team",
  capTableUrl: "/api/cap-table",
  subResourceBase: "/api/startup-profile",
  metricsApiBase: "/api/metrics",
};

export function OverviewTab() {
  return <InitialDataPanel apiConfig={FOUNDER_CONFIG} />;
}
