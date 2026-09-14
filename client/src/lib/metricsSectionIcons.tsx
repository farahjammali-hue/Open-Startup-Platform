import { ChartLineUp, CurrencyDollar, Users, Handshake, PiggyBank, type Icon } from "@phosphor-icons/react";

/**
 * Per-section icon for the Metrics & KPIs / Quarterly Updates tables, keyed
 * by MetricSection.key (shared/metricsCatalog.ts). Kept client-side (not in
 * the shared catalog) since the catalog is also imported server-side and
 * can't carry React component references.
 */
export const SECTION_ICONS: Record<string, Icon> = {
  sales: ChartLineUp,
  revenues: CurrencyDollar,
  hr: Users,
  partnerships: Handshake,
  fundraising: PiggyBank,
};

/** "I. Sales" -> "Sales" — section titles carry a roman-numeral prefix for the source spreadsheet; the UI now conveys order via an icon instead. */
export function stripRomanNumeral(title: string): string {
  return title.replace(/^[IVXLC]+\.\s*/, "");
}
