// @vitest-environment node
// A1: admins deciding on a contract / KYS / data-room document emails the
// startup's owner. This is also the first test that mounts the real routes,
// so the mocks below stub every module routes.ts pulls in that would
// otherwise open a DB pool, talk SMTP, or call Zoom.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server as HttpServer } from "http";

const fake = vi.hoisted(() => ({
  storage: {} as Record<string, any>,
  reviewMails: [] as any[],
}));

vi.mock("./storage", () => ({
  toPublicUser: (u: any) => u,
  storage: new Proxy(fake.storage, {
    // Any storage call the test didn't stub explodes loudly instead of
    // silently returning undefined.
    get: (t, prop: string) => t[prop] ?? (() => { throw new Error(`storage.${prop} not stubbed`); }),
  }),
}));
vi.mock("./auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  configureSession: () => {},
  configureGoogleAuth: () => {},
}));
vi.mock("./mailer", () => ({
  sendVerificationEmail: vi.fn(async () => true),
  smtpConfigured: () => false,
  sendEmailChangeVerification: vi.fn(async () => true),
  sendPasswordChangedNotice: vi.fn(async () => true),
  sendSessionInvite: vi.fn(async () => true),
  sendApplicationNotice: vi.fn(async () => true),
  sendApplicationDecision: vi.fn(async () => true),
  sendAdminBroadcast: vi.fn(async () => true),
  sendMcpConnectedNotice: vi.fn(async () => true),
  sendReviewDecision: vi.fn(async (opts: any) => { fake.reviewMails.push(opts); return true; }),
}));
vi.mock("./zoom", () => ({
  verifyZoomWebhookSignature: () => false,
  respondToZoomUrlValidation: () => null,
  downloadZoomRecordingFile: vi.fn(),
  zoomConfigured: () => false,
  listZoomHosts: vi.fn(async () => []),
  createZoomMeeting: vi.fn(),
  updateZoomMeeting: vi.fn(),
  deleteZoomMeeting: vi.fn(),
}));

import { registerRoutes } from "./routes";

let server: HttpServer;
let base: string;

async function post(path: string, body: any) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Waits for the fire-and-forget notify to land. */
async function reviewMail() {
  for (let i = 0; i < 50 && fake.reviewMails.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  return fake.reviewMails[0];
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Every request runs as a signed-in admin.
  app.use((req: any, _res, next) => { req.session = { userId: "admin1" }; next(); });
  registerRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

beforeEach(() => {
  fake.reviewMails.length = 0;
  for (const k of Object.keys(fake.storage)) delete fake.storage[k];
  Object.assign(fake.storage, {
    getUserById: async (id: string) =>
      id === "admin1"
        ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
        : { id, email: "founder@acme.io", firstName: "Amina", name: "Amina F", role: "startup", isActive: true },
    getStartupById: async (id: string) => ({ id, userId: "u1", companyName: "Acme" }),
  });
});

describe("review decisions email the founder (A1)", () => {
  it("contract rejection sends a changes-requested email with the note", async () => {
    Object.assign(fake.storage, {
      getContractById: async (id: string) => ({ id, startupId: "s1" }),
      reviewContract: async () => ({ id: "c1", status: "rejected" }),
      addContractEvent: async () => ({}),
    });
    const res = await post("/api/admin/contracts/c1/review", { status: "rejected", reviewNote: "Wrong signatory" });
    expect(res.status).toBe(200);
    const mail = await reviewMail();
    expect(mail).toMatchObject({
      to: "founder@acme.io",
      itemLabel: "program agreement",
      approved: false,
      note: "Wrong signatory",
    });
    expect(mail.link).toContain("/contract-kys");
  });

  it("KYS approval sends an approved email", async () => {
    Object.assign(fake.storage, {
      getKysProfileById: async (id: string) => ({ id, startupId: "s1" }),
      reviewKysProfile: async () => ({ id: "k1", status: "approved" }),
      addKysEvent: async () => ({}),
    });
    const res = await post("/api/admin/kys/k1/review", { status: "approved" });
    expect(res.status).toBe(200);
    const mail = await reviewMail();
    expect(mail).toMatchObject({ to: "founder@acme.io", itemLabel: "KYS profile", approved: true, note: null });
  });

  it("document review names the document", async () => {
    Object.assign(fake.storage, {
      getDocumentById: async (id: string) => ({ id, startupId: "s1", title: "Pitch Deck" }),
      reviewDocument: async () => ({ id: "d1", status: "approved" }),
      addDocumentEvent: async () => ({}),
    });
    const res = await post("/api/admin/documents/d1/review", { status: "approved" });
    expect(res.status).toBe(200);
    const mail = await reviewMail();
    expect(mail.itemLabel).toBe('document "Pitch Deck"');
    expect(mail.link).toContain("/data-room");
  });

  it("a mail failure never fails the review", async () => {
    Object.assign(fake.storage, {
      getContractById: async (id: string) => ({ id, startupId: "s1" }),
      reviewContract: async () => ({ id: "c1", status: "approved" }),
      addContractEvent: async () => ({}),
      // notifyReviewDecision's own lookup blows up — the review must still 200.
      getStartupById: async () => { throw new Error("db down"); },
    });
    const res = await post("/api/admin/contracts/c1/review", { status: "approved" });
    expect(res.status).toBe(200);
  });
});

describe("admin startups ?missingUpdate filter (A5)", () => {
  it("keeps only startups without a saved entry for the period", async () => {
    Object.assign(fake.storage, {
      listStartupsWithOwners: async () => [
        { id: "s1", companyName: "Acme" },
        { id: "s2", companyName: "Verdant" },
      ],
      listStartupIdsWithMetricEntry: async (period: string) => (period === "2026-09" ? ["s2"] : []),
    });
    const res = await fetch(`${base}/api/admin/startups?missingUpdate=2026-09`);
    const body = await res.json();
    expect(body.startups.map((s: any) => s.id)).toEqual(["s1"]);
    expect(body.missingUpdate).toBe("2026-09");
  });

  it("ignores a malformed period and returns everyone", async () => {
    Object.assign(fake.storage, {
      listStartupsWithOwners: async () => [{ id: "s1" }, { id: "s2" }],
    });
    const res = await fetch(`${base}/api/admin/startups?missingUpdate=DROP TABLE`);
    const body = await res.json();
    expect(body.startups).toHaveLength(2);
    expect(body.missingUpdate).toBeUndefined();
  });
});

describe("sent-message log (A7)", () => {
  it("cohort sends are logged with track and sender", async () => {
    const logs: any[] = [];
    Object.assign(fake.storage, {
      listCohortMessageRecipients: async () => [{ email: "a@x.io" }, { email: "b@x.io" }],
      logMessage: async (row: any) => logs.push(row),
    });
    const res = await post("/api/admin/messages/cohort", { track: "seed", subject: "Hello", body: "World", asSelf: false });
    expect(res.status).toBe(200);
    expect(logs[0]).toMatchObject({
      kind: "cohort_message",
      recipientEmails: ["a@x.io", "b@x.io"],
      subject: "Hello",
      sentBy: "admin@open-startup.org",
      meta: { track: "seed", asSelf: false, total: 2 },
    });
  });

  it("a send with zero recipients is not logged", async () => {
    const logs: any[] = [];
    Object.assign(fake.storage, {
      listCohortMessageRecipients: async () => [],
      logMessage: async (row: any) => logs.push(row),
    });
    const res = await post("/api/admin/messages/cohort", { track: "all", subject: "Hi", body: "There" });
    expect(res.status).toBe(200);
    expect(logs).toHaveLength(0);
  });

  it("startup sends log the startup id; /messages/log returns the history", async () => {
    const logs: any[] = [];
    Object.assign(fake.storage, {
      getStartupById: async (id: string) => ({ id, userId: "u1", companyName: "Acme" }),
      listStartupMessageRecipients: async () => [{ email: "founder@acme.io" }],
      logMessage: async (row: any) => logs.push(row),
      listMessageLog: async (opts: any) => [{ id: "l1", kind: opts.kind ?? "startup_message", subject: "S", recipientEmails: ["founder@acme.io"], sentBy: "admin@open-startup.org", meta: {}, sentAt: new Date().toISOString(), startupId: "s1", startupName: "Acme", bodyPreview: null }],
    });
    const send = await post("/api/admin/messages/startup/s1", { subject: "S", body: "B" });
    expect(send.status).toBe(200);
    expect(logs[0]).toMatchObject({ kind: "startup_message", startupId: "s1" });

    const list = await fetch(`${base}/api/admin/messages/log?kind=cohort_message`);
    const body = await list.json();
    expect(body.messages[0].kind).toBe("cohort_message");
  });
});

describe("portfolio metrics + office-hours admin (A11)", () => {
  it("sums headline metrics per month across startups, skipping the initial baseline", async () => {
    Object.assign(fake.storage, {
      listPortfolioMetricEntries: async () => [
        { startupId: "a", period: "initial", values: { rev_cumulative: 999999 } },
        { startupId: "a", period: "2026-08", values: { rev_cumulative: 1000, rev_mrr_b2b: 100, hr_team_size: 4 } },
        { startupId: "b", period: "2026-08", values: { rev_cumulative: "2,500", rev_mrr_b2c: 50, sales_burn_rate: 300 } },
        { startupId: "a", period: "2026-09", values: {} },
      ],
    });
    const res = await fetch(`${base}/api/admin/portfolio-metrics`);
    const { series } = await res.json();
    expect(series).toEqual([
      { period: "2026-08", reporting: 2, revCumulative: 3500, mrr: 150, burn: 300, teamSize: 4 },
      { period: "2026-09", reporting: 0, revCumulative: 0, mrr: 0, burn: 0, teamSize: 0 },
    ]);
  });

  it("office-hours create validates and rejects end-before-start", async () => {
    const created: any[] = [];
    Object.assign(fake.storage, {
      createOfficeHourSlot: async (d: any) => { created.push(d); return { id: "slot1", ...d }; },
    });
    const bad = await post("/api/admin/office-hours/slots", { hostName: "", startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T11:00" });
    expect(bad.status).toBe(400);
    const backwards = await post("/api/admin/office-hours/slots", { hostName: "Team", startsAt: "2026-10-01T11:00", endsAt: "2026-10-01T10:00" });
    expect(backwards.status).toBe(400);
    const ok = await post("/api/admin/office-hours/slots", { hostName: "Team", topic: "", startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T10:30", capacity: "3" });
    expect(ok.status).toBe(201);
    expect(created[0]).toMatchObject({ hostName: "Team", capacity: 3 });
  });
});
