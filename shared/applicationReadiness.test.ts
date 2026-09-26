// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeApplicationReadiness } from "./applicationReadiness";

const NOW = new Date(2026, 8, 26); // Sep 26, 2026

const COMPLETE = {
  startup: {
    shortDescription: "Solar for shops",
    detailedDescription: "Long story",
    location: "Tunis",
    stage: "growth",
    dataRoomLink: null,
  },
  kysSubmitted: true,
  contractUploaded: true,
  metricPeriodsWithValues: ["initial", "2026-08"],
  documentsCount: 2,
  now: NOW,
};

describe("computeApplicationReadiness", () => {
  it("is ready when everything is in", () => {
    const r = computeApplicationReadiness(COMPLETE);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.checks).toHaveLength(5);
  });

  it("names exactly what's missing, with a place to fix it", () => {
    const r = computeApplicationReadiness({
      ...COMPLETE,
      kysSubmitted: false,
      documentsCount: 0,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["KYS submitted", "Data room started (a document or a link)"]);
    expect(r.checks.find((c) => c.key === "kys")!.link).toBe("/contract-kys");
  });

  it("a data-room link counts even with zero uploaded documents", () => {
    const r = computeApplicationReadiness({
      ...COMPLETE,
      documentsCount: 0,
      startup: { ...COMPLETE.startup, dataRoomLink: "https://drive.google.com/x" },
    });
    expect(r.checks.find((c) => c.key === "dataRoom")!.ok).toBe(true);
  });

  it("metrics must be recent — last year's numbers don't count", () => {
    const stale = computeApplicationReadiness({ ...COMPLETE, metricPeriodsWithValues: ["2025-09", "initial"] });
    expect(stale.checks.find((c) => c.key === "metrics")!.ok).toBe(false);
    const lastMonth = computeApplicationReadiness({ ...COMPLETE, metricPeriodsWithValues: ["2026-08"] });
    expect(lastMonth.checks.find((c) => c.key === "metrics")!.ok).toBe(true);
  });

  it("blank-string profile fields don't pass the profile check", () => {
    const r = computeApplicationReadiness({
      ...COMPLETE,
      startup: { ...COMPLETE.startup, shortDescription: "  " },
    });
    expect(r.checks.find((c) => c.key === "profile")!.ok).toBe(false);
  });
});
