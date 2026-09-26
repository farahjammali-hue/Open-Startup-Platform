// Phase 3a of the data plan: ONE answer per contested question.
//
// The same fact about a startup lives in several stores (see DATA_MODEL.md
// §4 — monthly metric entries, Initial Data cards, survey columns, detail
// tables). Every reader that wants "the" current value resolves it here,
// with one precedence rule per fact, so the Claude connector, the admin
// charts and the investment-application snapshots can never disagree again.
//
// Pure functions only: callers fetch the rows (storage.canonicalFactsFor
// bundles that) and this module decides which value wins. Every fact carries
// {value, source, asOf} so consumers can always say where a number came from.

export interface MetricEntryLike {
  /** "initial" (program-entry baseline) or "YYYY-MM". */
  period: string;
  values?: Record<string, number | string> | null;
}

/** The startups-table columns the precedence rules read. */
export interface CanonicalStartupColumns {
  location?: string | null;
  country?: string | null;
  teamSize?: number | null; // Card 4
  lastValuation?: number | null; // Round Details block
  totalFundingRaised?: number | null; // Card 6
  totalFundingNonDilutive?: number | null; // Card 6
  totalGrants?: number | null; // legacy Traction block
  amountRaised?: number | null; // onboarding survey
  totalRevenueSinceFounding?: number | null; // legacy Traction block
}

export interface CanonicalInputs {
  startup: CanonicalStartupColumns;
  metricEntries: MetricEntryLike[];
  /** sum(startup_funding_rounds.amount); null when no round has an amount. */
  fundingRoundsTotal?: number | null;
  /** count(*) of team_members rows. */
  teamMembersCount?: number | null;
  /** kys_profiles.track — the ONLY field that means "program track". */
  kysTrack?: string | null;
}

export interface CanonicalFact<T = number> {
  value: T | null;
  /** "metric:<key>", "column:<name>", "sum:funding_rounds" or "count:team_members". */
  source: string | null;
  /** The period the value is from ("YYYY-MM" | "initial") when it came from metrics. */
  asOf: string | null;
}

export interface CanonicalFacts {
  teamSize: CanonicalFact;
  valuation: CanonicalFact;
  totalRaised: CanonicalFact;
  grants: CanonicalFact;
  cumulativeRevenue: CanonicalFact;
  mrr: CanonicalFact;
  hq: CanonicalFact<string>;
  programTrack: CanonicalFact<string>;
}

/** Tolerant of the money strings founders type ("$1,200,000"). */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "initial" is the oldest period; months compare lexicographically. */
function periodRank(p: string): string {
  return p === "initial" ? "0000-00" : p;
}

/** The most recent period whose values give `compute` a number. */
function latestMetric(
  entries: MetricEntryLike[],
  compute: (values: Record<string, number | string>) => number | null,
): { value: number; period: string } | null {
  const sorted = [...entries].sort((a, b) => (periodRank(a.period) < periodRank(b.period) ? 1 : -1));
  for (const e of sorted) {
    const v = compute(e.values ?? {});
    if (v !== null) return { value: v, period: e.period };
  }
  return null;
}

/** The freshest value of one metric key, with the period it came from. */
export function latestMetricValue(
  entries: MetricEntryLike[],
  key: string,
): { value: number; asOf: string } | null {
  const hit = latestMetric(entries, (values) => num(values[key]));
  return hit ? { value: hit.value, asOf: hit.period } : null;
}

function metricFact(entries: MetricEntryLike[], key: string): CanonicalFact | null {
  const hit = latestMetric(entries, (values) => num(values[key]));
  return hit ? { value: hit.value, source: `metric:${key}`, asOf: hit.period } : null;
}

function columnFact(value: number | null | undefined, column: string): CanonicalFact | null {
  return value === null || value === undefined ? null : { value, source: `column:${column}`, asOf: null };
}

function textFact(value: string | null | undefined, column: string): CanonicalFact<string> | null {
  const trimmed = value?.trim();
  return trimmed ? { value: trimmed, source: `column:${column}`, asOf: null } : null;
}

const EMPTY: CanonicalFact<never> = { value: null, source: null, asOf: null };

function first<T>(...facts: (CanonicalFact<T> | null)[]): CanonicalFact<T> {
  return facts.find((f): f is CanonicalFact<T> => f !== null) ?? (EMPTY as CanonicalFact<T>);
}

export function resolveCanonicalFacts(inputs: CanonicalInputs): CanonicalFacts {
  const { startup: s, metricEntries: entries } = inputs;

  return {
    // Latest monthly HR metric → Card 4 count → counting the team roster.
    teamSize: first(
      metricFact(entries, "hr_team_size"),
      columnFact(s.teamSize, "team_size"),
      inputs.teamMembersCount != null && inputs.teamMembersCount > 0
        ? { value: inputs.teamMembersCount, source: "count:team_members", asOf: null }
        : null,
    ),

    valuation: first(metricFact(entries, "fund_valuation"), columnFact(s.lastValuation, "last_valuation")),

    // Card 6 aggregate → adding up the round-by-round table → survey answer.
    totalRaised: first(
      columnFact(s.totalFundingRaised, "total_funding_raised"),
      inputs.fundingRoundsTotal != null
        ? { value: inputs.fundingRoundsTotal, source: "sum:funding_rounds", asOf: null }
        : null,
      columnFact(s.amountRaised, "amount_raised"),
    ),

    grants: first(
      columnFact(s.totalFundingNonDilutive, "total_funding_non_dilutive"),
      metricFact(entries, "fund_grants"),
      columnFact(s.totalGrants, "total_grants"),
    ),

    cumulativeRevenue: first(
      metricFact(entries, "rev_cumulative"),
      columnFact(s.totalRevenueSinceFounding, "total_revenue_since_founding"),
    ),

    // The latest period reporting either MRR stream; a missing stream counts 0.
    mrr: (() => {
      const hit = latestMetric(entries, (values) => {
        const b2b = num(values["rev_mrr_b2b"]);
        const b2c = num(values["rev_mrr_b2c"]);
        if (b2b === null && b2c === null) return null;
        return (b2b ?? 0) + (b2c ?? 0);
      });
      return hit ? { value: hit.value, source: "metric:rev_mrr_b2b+rev_mrr_b2c", asOf: hit.period } : { ...EMPTY };
    })(),

    hq: first(textFact(s.location, "location"), textFact(s.country, "country")),

    // startups.stage stays the MATURITY scale; the program track is KYS-only.
    programTrack: inputs.kysTrack
      ? { value: inputs.kysTrack, source: "kys_profiles.track", asOf: null }
      : { ...EMPTY },
  };
}
