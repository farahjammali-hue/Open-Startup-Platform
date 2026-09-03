export type StartupTechTrack = "deep_tech" | "soft_tech";

export interface KpiSection {
  title: string;
  fields: string[];
  prefilled?: boolean;
  // Which track(s) this section applies to. Omitted = both tracks.
  // Interim split until the team's revised, track-specific questions land.
  tracks?: StartupTechTrack[];
}

// The KPI collection sections, straight from the prototype's kpiFormSchema.
// Shared between the Dashboard's KPI collection form and the KPI
// visualizations deep dive, so both always agree on section titles and
// field labels (the labels double as keys into the `metrics` JSON blob).
export const KPI_SECTIONS: KpiSection[] = [
  { title: "1 · Startup profile", fields: ["Country / Region", "Sector / Industry", "Solution (one sentence)", "Business Model", "Establishment Date", "Incorporation status", "Type of Legal Structure", "Countries of Operation", "Planned Expansion Markets", "Pitch Deck (upload)", "SDGs Addressed"] },
  { title: "2 · Technology", fields: ["High-Level Technology Breakdown", "Detailed Technology Breakdown", "Technology Readiness Level (TRL)", "AI Integration", "Tech Expertise within the Team"], tracks: ["deep_tech"] },
  { title: "3 · Intellectual property", fields: ["Patent status", "IP Ownership Strategy", "Progress on International IP"], tracks: ["deep_tech"] },
  { title: "4 · Team & human capital", fields: ["Number of Employees", "Number of Full-Time Employees", "Number of Part-Time Employees", "Number of Female Employees", "Number of Female Employees in Leadership", "Number of Young Employees (under 35)", "Solo Talent(s) Recruited"], prefilled: true },
  { title: "5 · Funding & capital structure", fields: ["Amount Fundraised to Date", "Founder / Family / Friends (FFF)", "Non-Dilutive Funding / Grants", "Business Angel Funding", "Venture Capital Funding", "Debt Financing", "Currently Raising Funds?", "Total Target Size of Current Round", "Completed Funding Rounds", "Ownership Breakdown / Cap Table"] },
  { title: "6 · Commercial performance", fields: ["Revenue Since Establishment", "Annual Recurring Revenue (ARR)", "Monthly Recurring Revenue (MRR)", "Paying Customers / Active Users", "Customer Acquisition Cost (CAC)", "Lifetime Value (LTV)", "Gross Margin (%)", "Burn Rate", "North Star Metric (name + value)"] },
];

export function kpiSectionsForTrack(track: StartupTechTrack): KpiSection[] {
  return KPI_SECTIONS.filter((sec) => !sec.tracks || sec.tracks.includes(track));
}

// A handful of fields map onto the real typed KPI columns (so Overview /
// Growth tracker keep working); everything else lands in the flexible
// `metrics` JSON column that already exists on kpi_submissions for exactly
// this purpose.
export const KPI_FIELD_TO_COLUMN: Record<string, string> = {
  "Revenue Since Establishment": "revenue",
  "Paying Customers / Active Users": "activeUsers",
  "Burn Rate": "burnRate",
  "Number of Employees": "teamSize",
};
