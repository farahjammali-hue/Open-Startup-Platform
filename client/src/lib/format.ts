/** `$1,234`, or `—` for null/undefined — the money formatting repeated across Dashboard and KPI visualizations. */
export function formatMoney(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `$${n.toLocaleString()}`;
}

/** A number, optionally prefixed with `$` and/or suffixed (e.g. " mo", "%"). */
export function formatNumber(n: number, opts?: { money?: boolean; suffix?: string }): string {
  return `${opts?.money ? "$" : ""}${n.toLocaleString()}${opts?.suffix ?? ""}`;
}
