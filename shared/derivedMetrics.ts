// A2: metrics the spreadsheet asked founders to compute by hand, now derived
// from the numbers they already enter. Pure functions shared by the client
// (live suggestions in the Monthly Updates form) and tests; values stay
// ordinary metric entries once applied, so nothing downstream changes.

export interface DerivedSuggestion {
  /** Rounded, ready to store. */
  value: number;
  /** Plain-language explanation shown next to the suggestion. */
  formula: string;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Values = Record<string, number | string> | undefined;

/** LTV/CAC = LTV ÷ CAC — needs both, and a CAC above zero. */
export function ltvCacRatio(values: Values): DerivedSuggestion | null {
  const ltv = num(values?.["sales_ltv"]);
  const cac = num(values?.["sales_cac"]);
  if (ltv === null || cac === null || cac <= 0) return null;
  return { value: round2(ltv / cac), formula: `LTV ${ltv} ÷ CAC ${cac}` };
}

/** Monthly revenue change = this period's cumulative revenues minus the previous period's. */
export function monthlyRevenueChange(values: Values, prevValues: Values): DerivedSuggestion | null {
  const now = num(values?.["rev_cumulative"]);
  const before = num(prevValues?.["rev_cumulative"]);
  if (now === null || before === null) return null;
  return { value: round2(now - before), formula: `cumulative ${now} − previous ${before}` };
}

/**
 * Every derivable metric for one period. `prevValues` is the period before
 * (January's previous is the "initial" baseline; "initial" itself has none).
 */
export function computeDerived(values: Values, prevValues: Values): Record<string, DerivedSuggestion> {
  const out: Record<string, DerivedSuggestion> = {};
  const ltvCac = ltvCacRatio(values);
  if (ltvCac) out["sales_ltv_cac"] = ltvCac;
  const revChange = monthlyRevenueChange(values, prevValues);
  if (revChange) out["rev_monthly_change"] = revChange;
  return out;
}
