// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeDerived, ltvCacRatio, monthlyRevenueChange } from "./derivedMetrics";

describe("ltvCacRatio", () => {
  it("divides LTV by CAC and rounds to 2 decimals", () => {
    expect(ltvCacRatio({ sales_ltv: 1000, sales_cac: 300 })).toMatchObject({ value: 3.33 });
  });
  it("parses string inputs with $ and commas", () => {
    expect(ltvCacRatio({ sales_ltv: "$1,200", sales_cac: "400" })).toMatchObject({ value: 3 });
  });
  it("returns null when either side is missing, empty, garbage, or CAC is 0/negative", () => {
    expect(ltvCacRatio({ sales_ltv: 1000 })).toBeNull();
    expect(ltvCacRatio({ sales_ltv: "", sales_cac: 300 })).toBeNull();
    expect(ltvCacRatio({ sales_ltv: "n/a", sales_cac: 300 })).toBeNull();
    expect(ltvCacRatio({ sales_ltv: 1000, sales_cac: 0 })).toBeNull();
    expect(ltvCacRatio({ sales_ltv: 1000, sales_cac: -5 })).toBeNull();
    expect(ltvCacRatio(undefined)).toBeNull();
  });
});

describe("monthlyRevenueChange", () => {
  it("subtracts the previous period's cumulative revenue", () => {
    expect(monthlyRevenueChange({ rev_cumulative: 5000 }, { rev_cumulative: 3500 })).toMatchObject({ value: 1500 });
  });
  it("can be negative and handles the initial baseline as the previous period", () => {
    expect(monthlyRevenueChange({ rev_cumulative: "1,000" }, { rev_cumulative: "1200" })).toMatchObject({ value: -200 });
  });
  it("returns null without both cumulative values", () => {
    expect(monthlyRevenueChange({ rev_cumulative: 5000 }, {})).toBeNull();
    expect(monthlyRevenueChange({}, { rev_cumulative: 3500 })).toBeNull();
    expect(monthlyRevenueChange(undefined, undefined)).toBeNull();
  });
});

describe("computeDerived", () => {
  it("returns only the suggestions whose inputs exist", () => {
    const out = computeDerived({ sales_ltv: 900, sales_cac: 300 }, undefined);
    expect(Object.keys(out)).toEqual(["sales_ltv_cac"]);
    expect(out.sales_ltv_cac.value).toBe(3);
    expect(out.sales_ltv_cac.formula).toContain("LTV");
  });
  it("returns both when everything is present", () => {
    const out = computeDerived(
      { sales_ltv: 900, sales_cac: 300, rev_cumulative: 10 },
      { rev_cumulative: 4 },
    );
    expect(Object.keys(out).sort()).toEqual(["rev_monthly_change", "sales_ltv_cac"]);
  });
});
