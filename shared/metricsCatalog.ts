// Single source of truth for the "Metrics & KPIs" tab's fields — transcribed
// from the program's real tracking spreadsheet. Shared by client (labels)
// and server (rejecting unknown metric keys).

export interface MetricDef {
  key: string;
  label: string;
  /** Set on dollar-denominated metrics so the UI can show a "$" prefix by default. */
  unit?: "money";
}

export interface MetricSection {
  key: string;
  title: string;
  metrics: MetricDef[];
  /** Field name on startupMetricsProfile holding this section's free-text note. */
  noteField: string;
  noteLabel: string;
}

export const METRIC_SECTIONS: MetricSection[] = [
  {
    key: "sales",
    title: "I. Sales",
    noteField: "salesNotes",
    noteLabel: "Notes",
    metrics: [
      { key: "sales_pipeline_b2b", label: "Pipeline size (B2B) / cumulative" },
      { key: "sales_pipeline_patient_per_month", label: "Pipeline size (patient) / per month" },
      { key: "sales_lois", label: "LOIs" },
      { key: "sales_pilots_paid", label: "Pilots (paid)" },
      { key: "sales_paying_contracts_b2b", label: "Paying contracts (B2B)" },
      { key: "sales_paying_customers_b2c", label: "Paying customer (B2C)" },
      { key: "sales_retention_b2b_pct", label: "Retention Rate B2B (%)" },
      { key: "sales_retention_b2c_pct", label: "Retention Rate B2C (%)" },
      { key: "sales_b2c_revenue_subscription", label: "B2C Revenue - subscription", unit: "money" },
      { key: "sales_transaction_revenue_b2c", label: "Transaction based revenue ($) B2C", unit: "money" },
      { key: "sales_cac", label: "CAC ($)", unit: "money" },
      { key: "sales_burn_rate", label: "Burn Rate ($)", unit: "money" },
      { key: "sales_runway_months", label: "Runway (N° of months)" },
      { key: "sales_ltv", label: "LTV (patient/B2C)", unit: "money" },
      { key: "sales_profit_margin", label: "Profit margin" },
      { key: "sales_ltv_cac", label: "LTV/CAC" },
    ],
  },
  {
    key: "revenues",
    title: "II. Revenues",
    noteField: "revenueNotes",
    noteLabel: "Major revenue sources",
    metrics: [
      { key: "rev_mrr_b2b", label: "MRR (B2B)", unit: "money" },
      { key: "rev_mrr_b2c", label: "MRR (B2C)", unit: "money" },
      { key: "rev_cumulative", label: "Cumulative revenues", unit: "money" },
      { key: "rev_monthly_change", label: "Monthly change in total revenue", unit: "money" },
    ],
  },
  {
    key: "hr",
    title: "III. Human Resources",
    noteField: "teamRecruitNotes",
    noteLabel: "Key Profiles to recruit",
    metrics: [
      { key: "hr_founders", label: "Founders" },
      { key: "hr_team_size", label: "Team Size" },
      { key: "hr_contractors", label: "Contractors" },
      { key: "hr_advisors", label: "Advisors" },
      { key: "hr_pct_youth", label: "% Youth in the team" },
      { key: "hr_paid_employees", label: "Number of paid employees" },
      { key: "hr_female_employees", label: "Number of female employees" },
    ],
  },
  {
    key: "partnerships",
    title: "IV. Partnerships",
    noteField: "partnershipNotes",
    noteLabel: "Partnerships obtained during the program",
    metrics: [
      { key: "partner_total", label: "Total Partnerships" },
      { key: "partner_industrial_tech", label: "Industrial / Technology Partners" },
      { key: "partner_corporate_commercial", label: "Corporate / Commercial Partners" },
      { key: "partner_business_distribution", label: "Business / Distribution Partners" },
      { key: "partner_research_academic", label: "Research & Academic Partners" },
      { key: "partner_investment_financial", label: "Investment & Financial Partners" },
      { key: "partner_ecosystem_strategic", label: "Ecosystem & Strategic Support Partners" },
    ],
  },
  {
    key: "fundraising",
    title: "V. Fundraising Status",
    noteField: "fundraisingNotes",
    noteLabel: "Investors in the round / grant issuer",
    metrics: [
      { key: "fund_investment_raised", label: "Investment Raised", unit: "money" },
      { key: "fund_equity_terms", label: "Equity/Convertibles terms" },
      { key: "fund_valuation", label: "Valuation", unit: "money" },
      { key: "fund_grants", label: "Grants", unit: "money" },
    ],
  },
];

export const ALL_METRIC_KEYS = new Set(
  METRIC_SECTIONS.flatMap((s) => s.metrics.map((m) => m.key)),
);

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** "2026-01".."2026-12" for the given year, in order. */
export function monthPeriodsForYear(year: number): string[] {
  return MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/** Q1 = March (index 2), Q2 = June (index 5), Q3 = September (index 8), Q4 = December (index 11) — quarter-end snapshot, matching the source spreadsheet's own formulas. */
export const QUARTER_END_MONTH_INDEX = [2, 5, 8, 11] as const;

// Section VI — Data Room readiness checklist, each item tracked at two
// points in time (Inception / Graduation).
export const DATA_ROOM_ITEMS: MetricDef[] = [
  { key: "website", label: "Website" },
  { key: "product_demo", label: "Product demo / screenshots" },
  { key: "deck", label: "Deck" },
  { key: "financial_model", label: "Financial model" },
  { key: "registration_documents", label: "Registration documents" },
  { key: "shareholder_agreement", label: "Shareholder agreement" },
  { key: "cap_table", label: "Cap Table" },
  { key: "product_roadmap", label: "Product Roadmap" },
  { key: "technology_roadmap", label: "Technology roadmap" },
  { key: "sales_status", label: "Sales status" },
  { key: "partnerships_overview", label: "Partnerships overview" },
  { key: "gtm", label: "GTM" },
  { key: "investor_crm", label: "Investor CRM" },
  { key: "trademarks", label: "Trademarks" },
  { key: "patents", label: "Patents" },
  { key: "ip", label: "IP" },
];

// Section VI — Company Profile fields, grouped, each captured at Inception
// and Graduation.
export interface CompanyProfileGroup {
  title: string;
  fields: MetricDef[];
}

export const COMPANY_PROFILE_GROUPS: CompanyProfileGroup[] = [
  {
    title: "Technology",
    fields: [
      { key: "tech_hardware", label: "Hardware if applicable" },
      { key: "tech_ip_status", label: "IP status" },
      { key: "tech_stage", label: "Stage of development" },
    ],
  },
  {
    title: "Legal",
    fields: [
      { key: "legal_incorporated", label: "Incorporated" },
      { key: "legal_domicile", label: "Domicile" },
    ],
  },
  {
    title: "Regulatory",
    fields: [
      { key: "regulatory_status", label: "Preparing / applied / approved" },
    ],
  },
  {
    title: "Impact",
    fields: [
      { key: "impact_sdgs", label: "SDGs" },
    ],
  },
];
