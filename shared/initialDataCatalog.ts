// Single source of truth for the "Initial Data" tab's choice-field options —
// shared by client (labels) and server (rejecting unknown values).

export interface Option {
  value: string;
  label: string;
}

export const BUSINESS_MODEL_OPTIONS: Option[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "b2b2c", label: "B2B2C" },
  { value: "b2g", label: "B2G" },
];

export const PRODUCT_STAGE_OPTIONS: Option[] = [
  { value: "idea_concept", label: "Idea / Concept" },
  { value: "prototype_poc", label: "Prototype / Proof of Concept" },
  { value: "mvp", label: "MVP (Minimum Viable Product)" },
  { value: "beta_pilot", label: "Beta / Pilot" },
  { value: "launched", label: "Launched / Market-ready" },
  { value: "growth_scaling", label: "Growth / Scaling" },
  { value: "mature", label: "Mature" },
];

export const INVESTMENT_STAGE_OPTIONS: Option[] = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
];

export const FUNDING_TYPE_OPTIONS: Option[] = [
  { value: "grant", label: "Grant" },
  { value: "equity", label: "Equity" },
  { value: "convertible", label: "Convertible" },
  { value: "other", label: "Other" },
];

export const PATENT_APPLICATION_TYPE_OPTIONS: Option[] = [
  { value: "pct_with_priority", label: "PCT Based with Priority" },
  { value: "with_priority", label: "With Priority" },
  { value: "provisional", label: "Provisional" },
];

export const PATENT_STATUS_OPTIONS: Option[] = [
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "granted", label: "Granted" },
  { value: "closed", label: "Closed" },
];

export const GTM_STATUS_OPTIONS: Option[] = [
  { value: "operating_market", label: "Operating Market" },
  { value: "market_research", label: "Market research" },
  { value: "early_clients", label: "Early clients" },
  { value: "early_partners", label: "Early partners" },
];

export const CLIENT_TYPE_OPTIONS: Option[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "b2b2c", label: "B2B2C" },
  { value: "b2g", label: "B2G" },
];

export const PARTNER_TYPE_OPTIONS: Option[] = [
  { value: "industrial_technology", label: "Industrial / Technology Partners" },
  { value: "corporate_commercial", label: "Corporate / Commercial Partners" },
  { value: "business_distribution", label: "Business / Distribution Partners" },
  { value: "research_academic", label: "Research & Academic Partners" },
  { value: "investment_financial", label: "Investment & Financial Partners" },
  { value: "ecosystem_strategic", label: "Ecosystem & Strategic Support Partners" },
];

export const INVOLVEMENT_OPTIONS: Option[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part time" },
  { value: "advisor", label: "Advisor" },
  { value: "inactive", label: "Inactive" },
];

export const TRL_EXPLAINER_URL =
  "https://www.nasa.gov/directorates/somd/space-communications-navigation-program/technology-readiness-levels/";

function values(options: Option[]): [string, ...string[]] {
  return options.map((o) => o.value) as [string, ...string[]];
}

export const BUSINESS_MODEL_VALUES = values(BUSINESS_MODEL_OPTIONS);
export const PRODUCT_STAGE_VALUES = values(PRODUCT_STAGE_OPTIONS);
export const INVESTMENT_STAGE_VALUES = values(INVESTMENT_STAGE_OPTIONS);
export const FUNDING_TYPE_VALUES = values(FUNDING_TYPE_OPTIONS);
export const PATENT_APPLICATION_TYPE_VALUES = values(PATENT_APPLICATION_TYPE_OPTIONS);
export const PATENT_STATUS_VALUES = values(PATENT_STATUS_OPTIONS);
export const GTM_STATUS_VALUES = values(GTM_STATUS_OPTIONS);
export const CLIENT_TYPE_VALUES = values(CLIENT_TYPE_OPTIONS);
export const PARTNER_TYPE_VALUES = values(PARTNER_TYPE_OPTIONS);
export const INVOLVEMENT_VALUES = values(INVOLVEMENT_OPTIONS);
