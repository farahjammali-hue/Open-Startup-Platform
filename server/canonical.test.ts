// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveCanonicalFacts, type CanonicalInputs } from "./canonical";

const BARE: CanonicalInputs = { startup: {}, metricEntries: [] };

describe("resolveCanonicalFacts", () => {
  it("returns all-null facts (with null provenance) when nothing is stored", () => {
    const facts = resolveCanonicalFacts(BARE);
    for (const fact of Object.values(facts)) {
      expect(fact).toEqual({ value: null, source: null, asOf: null });
    }
  });

  it("teamSize: latest monthly metric beats Card 4 beats the roster count", () => {
    const metric = resolveCanonicalFacts({
      startup: { teamSize: 5 },
      metricEntries: [{ period: "2026-08", values: { hr_team_size: 9 } }],
      teamMembersCount: 3,
    });
    expect(metric.teamSize).toEqual({ value: 9, source: "metric:hr_team_size", asOf: "2026-08" });

    const card = resolveCanonicalFacts({ startup: { teamSize: 5 }, metricEntries: [], teamMembersCount: 3 });
    expect(card.teamSize).toEqual({ value: 5, source: "column:team_size", asOf: null });

    const roster = resolveCanonicalFacts({ startup: {}, metricEntries: [], teamMembersCount: 3 });
    expect(roster.teamSize).toEqual({ value: 3, source: "count:team_members", asOf: null });

    // Zero roster rows means "unknown", not "a team of zero".
    const unknown = resolveCanonicalFacts({ startup: {}, metricEntries: [], teamMembersCount: 0 });
    expect(unknown.teamSize.value).toBeNull();
  });

  it('"initial" is the oldest period — any month beats it', () => {
    const facts = resolveCanonicalFacts({
      startup: {},
      metricEntries: [
        { period: "initial", values: { fund_valuation: 1_000_000 } },
        { period: "2025-01", values: { fund_valuation: 4_000_000 } },
      ],
    });
    expect(facts.valuation).toEqual({ value: 4_000_000, source: "metric:fund_valuation", asOf: "2025-01" });
  });

  it("skips periods where the metric is blank, and parses money strings", () => {
    const facts = resolveCanonicalFacts({
      startup: { lastValuation: 2_000_000 },
      metricEntries: [
        { period: "2026-09", values: { fund_valuation: "" } },
        { period: "2026-07", values: { fund_valuation: "$1,200,000" } },
      ],
    });
    expect(facts.valuation).toEqual({ value: 1_200_000, source: "metric:fund_valuation", asOf: "2026-07" });
  });

  it("a stored zero is a real value, not a gap", () => {
    const facts = resolveCanonicalFacts({
      startup: { totalFundingRaised: 0, amountRaised: 500_000 },
      metricEntries: [],
    });
    expect(facts.totalRaised).toEqual({ value: 0, source: "column:total_funding_raised", asOf: null });
  });

  it("totalRaised: Card 6 → sum of funding rounds → survey answer", () => {
    const rounds = resolveCanonicalFacts({
      startup: { amountRaised: 100_000 },
      metricEntries: [],
      fundingRoundsTotal: 350_000,
    });
    expect(rounds.totalRaised).toEqual({ value: 350_000, source: "sum:funding_rounds", asOf: null });

    const survey = resolveCanonicalFacts({
      startup: { amountRaised: 100_000 },
      metricEntries: [],
      fundingRoundsTotal: null,
    });
    expect(survey.totalRaised).toEqual({ value: 100_000, source: "column:amount_raised", asOf: null });
  });

  it("grants: Card 6 non-dilutive → latest fund_grants metric → legacy total_grants", () => {
    const metric = resolveCanonicalFacts({
      startup: { totalGrants: 10_000 },
      metricEntries: [{ period: "2026-05", values: { fund_grants: 25_000 } }],
    });
    expect(metric.grants).toEqual({ value: 25_000, source: "metric:fund_grants", asOf: "2026-05" });

    const card = resolveCanonicalFacts({
      startup: { totalFundingNonDilutive: 40_000, totalGrants: 10_000 },
      metricEntries: [{ period: "2026-05", values: { fund_grants: 25_000 } }],
    });
    expect(card.grants.value).toBe(40_000);

    const legacy = resolveCanonicalFacts({ startup: { totalGrants: 10_000 }, metricEntries: [] });
    expect(legacy.grants).toEqual({ value: 10_000, source: "column:total_grants", asOf: null });
  });

  it("mrr: sums both streams in the latest period that reports either", () => {
    const facts = resolveCanonicalFacts({
      startup: {},
      metricEntries: [
        { period: "2026-07", values: { rev_mrr_b2b: 800, rev_mrr_b2c: 200 } },
        { period: "2026-08", values: { rev_mrr_b2c: 300 } }, // newer, one stream only
      ],
    });
    expect(facts.mrr).toEqual({ value: 300, source: "metric:rev_mrr_b2b+rev_mrr_b2c", asOf: "2026-08" });
  });

  it("hq: survey location wins; blank falls back to Card 1 country", () => {
    const location = resolveCanonicalFacts({ startup: { location: "Tunis", country: "Tunisia" }, metricEntries: [] });
    expect(location.hq).toEqual({ value: "Tunis", source: "column:location", asOf: null });

    const country = resolveCanonicalFacts({ startup: { location: "  ", country: "Tunisia" }, metricEntries: [] });
    expect(country.hq).toEqual({ value: "Tunisia", source: "column:country", asOf: null });
  });

  it("programTrack comes from the KYS profile only", () => {
    const facts = resolveCanonicalFacts({ ...BARE, kysTrack: "pre_seed" });
    expect(facts.programTrack).toEqual({ value: "pre_seed", source: "kys_profiles.track", asOf: null });
    expect(resolveCanonicalFacts(BARE).programTrack.value).toBeNull();
  });

  it("cumulativeRevenue: latest rev_cumulative beats the legacy column", () => {
    const facts = resolveCanonicalFacts({
      startup: { totalRevenueSinceFounding: 90_000 },
      metricEntries: [{ period: "2026-08", values: { rev_cumulative: 120_000 } }],
    });
    expect(facts.cumulativeRevenue).toEqual({ value: 120_000, source: "metric:rev_cumulative", asOf: "2026-08" });
  });
});
