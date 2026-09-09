// Single source of truth for the CRM module's tabs and select-field options —
// transcribed from the program's real CRM tracking spreadsheet (the sheet's
// own "Category" column becomes these three tabs, so it isn't a stored field).

export const CRM_CATEGORIES = [
  { key: "investor", label: "Investors" },
  { key: "client", label: "Clients" },
  { key: "partner", label: "Partners" },
] as const;

export type CrmCategory = (typeof CRM_CATEGORIES)[number]["key"];
export const CRM_CATEGORY_KEYS = CRM_CATEGORIES.map((c) => c.key) as [CrmCategory, ...CrmCategory[]];

// The exact dropdown lists (Excel data-validation) from the source CRM
// spreadsheet's Priority, Status, and Type columns — kept verbatim (including
// "Meduim") so the toggles here match what the program already uses.
export const CRM_PRIORITY_OPTIONS = ["High", "Important", "Meduim", "Low"] as const;

export const CRM_STATUS_OPTIONS = [
  "Contacted",
  "Committed/Signed",
  "Ongoing conversations",
  "On hold",
  "Not Happening",
  "Due diligence",
  "Keep Updated future round",
] as const;

export const CRM_TYPE_OPTIONS = [
  "Industrial / Technology Partners",
  "Corporate / Commercial Partners",
  "Business / Distribution Partners",
  "Research & Academic Partners",
  "Investment & Financial Partners",
  "Ecosystem & Strategic Support Partners",
] as const;

export interface CrmFieldDef {
  key: "name" | "type" | "description" | "priority" | "status" | "introVia" | "lastContact"
    | "ctaStartup" | "ctaOst" | "howItHelps" | "contractValue" | "proof";
  label: string;
  kind: "text" | "textarea" | "select";
  options?: readonly string[];
}

export const CRM_FIELDS: CrmFieldDef[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "type", label: "Type", kind: "select", options: CRM_TYPE_OPTIONS },
  { key: "description", label: "Description / Relevance", kind: "textarea" },
  { key: "priority", label: "Priority", kind: "select", options: CRM_PRIORITY_OPTIONS },
  { key: "status", label: "Status", kind: "select", options: CRM_STATUS_OPTIONS },
  { key: "introVia", label: "Intro Via", kind: "text" },
  { key: "lastContact", label: "Last Contact", kind: "text" },
  { key: "ctaStartup", label: "Call to Action — Startup", kind: "textarea" },
  { key: "ctaOst", label: "Call to Action — OST", kind: "textarea" },
  { key: "howItHelps", label: "How It Helps the Startup Scale", kind: "textarea" },
  { key: "contractValue", label: "Contract Value", kind: "text" },
  { key: "proof", label: "Proof (Screenshot, Email, Doc, etc.)", kind: "textarea" },
];
