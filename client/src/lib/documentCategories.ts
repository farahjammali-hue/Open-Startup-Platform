export type DocumentCategory =
  | "legal"
  | "financial"
  | "product"
  | "team"
  | "fundraising"
  | "other"
  | "main_docs"
  | "intellectual_property"
  | "metrics";

/**
 * Shared by the founder's Data Room and the admin's cross-startup Data Room review.
 * Labels match the OST GROW 3.0 Data Room Checklist categories. "product" is kept
 * only for backward compatibility with documents uploaded before the checklist
 * existed — it's not one of the checklist's own categories.
 */
export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  main_docs: "Main Docs & Summary",
  financial: "Financials",
  legal: "Legal",
  fundraising: "Previous Funding",
  intellectual_property: "Intellectual Property",
  team: "Staff",
  metrics: "Metrics",
  other: "Other",
  product: "Product",
};
