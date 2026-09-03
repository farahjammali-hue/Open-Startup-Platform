import { describe, it, expect } from "vitest";
import { formatMoney, formatNumber } from "./format";

// Number formatting is locale-dependent (`toLocaleString()` uses the host's
// default locale, matching the app's own un-pinned usage elsewhere), so
// these compare against the runtime's own formatting rather than a
// hardcoded en-US string.
describe("formatMoney", () => {
  it("prefixes a dollar sign and adds the locale's thousands separator", () => {
    expect(formatMoney(1234)).toBe(`$${(1234).toLocaleString()}`);
  });

  it("handles zero", () => {
    expect(formatMoney(0)).toBe("$0");
  });

  it("handles negative numbers", () => {
    expect(formatMoney(-500)).toBe(`$${(-500).toLocaleString()}`);
  });
});

describe("formatNumber", () => {
  it("renders a plain number with no options", () => {
    expect(formatNumber(1234)).toBe((1234).toLocaleString());
  });

  it("prefixes with $ when money is true", () => {
    expect(formatNumber(1234, { money: true })).toBe(`$${(1234).toLocaleString()}`);
  });

  it("appends a suffix when given", () => {
    expect(formatNumber(6, { suffix: " mo" })).toBe(`${(6).toLocaleString()} mo`);
  });

  it("combines money and suffix", () => {
    expect(formatNumber(100, { money: true, suffix: "%" })).toBe(`$${(100).toLocaleString()}%`);
  });
});
