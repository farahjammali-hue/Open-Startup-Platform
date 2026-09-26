// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  startups: [] as any[],
  reported: [] as string[],
  reminded: [] as string[],
  mails: [] as any[],
  logs: [] as any[],
}));

vi.mock("./storage", () => ({
  storage: {
    listStartupsWithOwners: async () => fake.startups,
    listStartupIdsWithMetricEntry: async () => fake.reported,
    listRemindedStartupIds: async () => fake.reminded,
    logMessage: async (row: any) => fake.logs.push(row),
  },
}));
vi.mock("./mailer", () => ({
  sendMetricsReminder: vi.fn(async (opts: any) => {
    fake.mails.push(opts);
    return true;
  }),
}));

import { periodOf, reminderTrigger, sendMonthlyMetricsReminders } from "./scheduler";

function startup(id: string, over: any = {}) {
  return {
    id,
    companyName: `S-${id}`,
    ownerName: "Founder",
    ownerEmail: `${id}@x.io`,
    kysStatus: "pending",
    contractStatus: "pending",
    ...over,
  };
}

beforeEach(() => {
  fake.startups.length = 0;
  fake.reported.length = 0;
  fake.reminded.length = 0;
  fake.mails.length = 0;
  fake.logs.length = 0;
});

describe("reminderTrigger", () => {
  it("fires on the 24th, the last day of the month, and never in between", () => {
    expect(reminderTrigger(new Date(2026, 8, 24))).toBe("day24");
    expect(reminderTrigger(new Date(2026, 8, 30))).toBe("monthEnd"); // September has 30 days
    expect(reminderTrigger(new Date(2026, 1, 28))).toBe("monthEnd"); // February 2026
    expect(reminderTrigger(new Date(2026, 8, 12))).toBeNull();
    expect(reminderTrigger(new Date(2026, 8, 29))).toBeNull();
  });
});

describe("sendMonthlyMetricsReminders", () => {
  const day24 = new Date(2026, 8, 24);

  it("does nothing on a non-trigger day", async () => {
    fake.startups.push(startup("a"));
    expect(await sendMonthlyMetricsReminders(new Date(2026, 8, 10))).toBe(0);
    expect(fake.mails).toHaveLength(0);
  });

  it("reminds only unreported, onboarded startups, and records each in the ledger", async () => {
    fake.startups.push(
      startup("a"), // should be reminded
      startup("b"), // reported already
      startup("c", { kysStatus: null }), // onboarding unfinished
      startup("d", { ownerEmail: null }), // no email on file
    );
    fake.reported.push("b");
    const sent = await sendMonthlyMetricsReminders(day24);
    expect(sent).toBe(1);
    expect(fake.mails[0]).toMatchObject({ to: "a@x.io", startupName: "S-a", lastCall: false });
    expect(fake.logs[0]).toMatchObject({
      kind: "reminder",
      startupId: "a",
      sentBy: "system",
      meta: { period: periodOf(day24), trigger: "day24", delivered: true },
    });
  });

  it("never doubles up: an already-reminded startup is skipped", async () => {
    fake.startups.push(startup("a"));
    fake.reminded.push("a");
    expect(await sendMonthlyMetricsReminders(day24)).toBe(0);
    expect(fake.mails).toHaveLength(0);
    expect(fake.logs).toHaveLength(0);
  });

  it("month-end uses last-call wording", async () => {
    fake.startups.push(startup("a"));
    await sendMonthlyMetricsReminders(new Date(2026, 8, 30));
    expect(fake.mails[0].lastCall).toBe(true);
    expect(fake.logs[0].meta.trigger).toBe("monthEnd");
  });
});
