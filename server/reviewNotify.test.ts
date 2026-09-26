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
  sendMetricsReminder: vi.fn(async () => true),
  sendInvestmentApplicationNotice: vi.fn(async () => true),
  sendInvestmentDecision: vi.fn(async () => true),
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
  // Every request runs as a signed-in admin, unless the test names another
  // user via the x-test-user header (for role-gate tests).
  app.use((req: any, _res, next) => { req.session = { userId: (req.headers["x-test-user"] as string) || "admin1" }; next(); });
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


describe("alumni role gates + graduation (Phase D)", () => {
  function users(role: string) {
    Object.assign(fake.storage, {
      getUserById: async (id: string) =>
        id === "admin1"
          ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
          : { id, email: "alum@x.io", name: "Alum", role, isActive: true },
    });
  }

  it("training/mentorship/office-hours/school are 403 for alumni, open for startups", async () => {
    users("alumni");
    for (const path of ["/api/mentorship", "/api/training", "/api/office-hours/slots", "/api/school"]) {
      const res = await fetch(`${base}${path}`, { headers: { "x-test-user": "u9" } });
      expect(res.status, path).toBe(403);
    }
    users("startup");
    Object.assign(fake.storage, {
      resolveActiveStartup: async () => undefined, // stops after the role gate
    });
    const res = await fetch(`${base}/api/mentorship`, { headers: { "x-test-user": "u9" } });
    expect(res.status).not.toBe(403);
  });

  it("graduating flips the owner to alumni, restores complete onboarding, stamps graduatedAt", async () => {
    const calls: any[] = [];
    users("startup");
    Object.assign(fake.storage, {
      getStartupById: async (id: string) => ({ id, userId: "u9", companyName: "Acme" }),
      setUserRole: async (id: string, role: string) => calls.push(["setUserRole", id, role]),
      approveUser: async (id: string) => calls.push(["approveUser", id]),
      updateStartup: async (id: string, data: any) => {
        calls.push(["updateStartup", id, !!data.graduatedAt]);
        return { id, graduatedAt: data.graduatedAt };
      },
    });
    const res = await post("/api/admin/startups/s1/graduate", {});
    expect(res.status).toBe(200);
    expect(calls).toEqual([
      ["setUserRole", "u9", "alumni"],
      ["approveUser", "u9"],
      ["updateStartup", "s1", true],
    ]);
  });

  it("refuses to graduate an admin demo startup", async () => {
    users("admin");
    Object.assign(fake.storage, {
      getStartupById: async (id: string) => ({ id, userId: "u9", companyName: "Demo" }),
    });
    const res = await post("/api/admin/startups/s1/graduate", {});
    expect(res.status).toBe(400);
  });
});

describe("investment applications (Phase D5)", () => {
  const READY = {
    id: "s1",
    userId: "u9",
    companyName: "Acme",
    shortDescription: "x",
    detailedDescription: "y",
    location: "Tunis",
    stage: "growth",
    dataRoomLink: null,
    revenueLast12Months: 240000,
    totalFundingRaised: 100000,
    lastValuation: 2000000,
    graduatedAt: "2026-06-01",
  };
  const CURRENT = new Date().toISOString().slice(0, 7);
  const ANSWERS = {
    amountSought: "$250k",
    roundType: "SAFE",
    useOfFunds: "Sales team",
    tractionNarrative: "Growing 15% MoM",
    timeline: "",
  };

  function alumniWorld(over: Record<string, any> = {}) {
    const state: { apps: any[]; logs: any[] } = { apps: [], logs: [] };
    Object.assign(fake.storage, {
      getUserById: async (id: string) =>
        id === "admin1"
          ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
          : { id, email: "alum@x.io", firstName: "Alum", name: "Alum A", role: "alumni", isActive: true },
      resolveActiveStartup: async () => READY,
      getKysProfile: async () => ({ id: "k1" }),
      getContract: async () => ({ id: "c1" }),
      listMetricEntries: async () => [{ period: CURRENT, values: { rev_cumulative: 1 } }],
      listDocuments: async () => [{ id: "d1" }],
      listInvestmentApplicationsForStartup: async () => state.apps,
      saveInvestmentDraft: async (startupId: string, userId: string, answers: any) => {
        let draft = state.apps.find((a) => a.status === "draft");
        if (!draft) {
          draft = { id: "app1", startupId, userId, status: "draft", answers };
          state.apps.push(draft);
        } else draft.answers = answers;
        return draft;
      },
      submitInvestmentApplication: async (id: string, answers: any, snapshot: any) => {
        const found = state.apps.find((a) => a.id === id)!;
        Object.assign(found, { status: "submitted", answers, snapshot, submittedAt: new Date() });
        return found;
      },
      listAdminEmails: async () => [{ email: "admin@open-startup.org", name: null }],
      getInvestmentApplication: async (id: string) => state.apps.find((a) => a.id === id),
      decideInvestmentApplication: async (id: string, data: any) => {
        const found = state.apps.find((a) => a.id === id)!;
        Object.assign(found, { status: data.status, decisionNote: data.note });
        return found;
      },
      getStartupById: async () => READY,
      logMessage: async (row: any) => state.logs.push(row),
      ...over,
    });
    return state;
  }

  it("startup-role users get 403 from the application APIs", async () => {
    alumniWorld({
      getUserById: async (id: string) =>
        id === "admin1"
          ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
          : { id, email: "f@x.io", role: "startup", isActive: true },
    });
    const res = await fetch(`${base}/api/investment-applications`, { headers: { "x-test-user": "u9" } });
    expect(res.status).toBe(403);
  });

  it("submit enforces readiness server-side and freezes the snapshot", async () => {
    alumniWorld({
      listDocuments: async () => [],
      resolveActiveStartup: async () => ({ ...READY, dataRoomLink: null }),
    });
    const notReady = await fetch(`${base}/api/investment-applications/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "u9" },
      body: JSON.stringify({ answers: ANSWERS }),
    });
    expect(notReady.status).toBe(400);
    expect((await notReady.json()).message).toMatch(/Data room/);

    alumniWorld(); // fully ready now
    const ok = await fetch(`${base}/api/investment-applications/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "u9" },
      body: JSON.stringify({ answers: ANSWERS }),
    });
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.status).toBe("submitted");
    expect(body.snapshot.headline.companyName).toBe("Acme");
    expect(body.snapshot.readiness.ready).toBe(true);
  });

  it("a pending application blocks another submission", async () => {
    alumniWorld({
      listInvestmentApplicationsForStartup: async () => [{ id: "old", status: "under_review" }],
    });
    const res = await fetch(`${base}/api/investment-applications/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "u9" },
      body: JSON.stringify({ answers: ANSWERS }),
    });
    expect(res.status).toBe(409);
  });

  it("an admin decision emails the founder and lands in the message log", async () => {
    const state = alumniWorld();
    state.apps.push({ id: "app9", startupId: "s1", userId: "u9", status: "submitted", answers: ANSWERS });
    const res = await post("/api/admin/investment-applications/app9/decision", { status: "accepted", note: "Welcome aboard" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    for (let i = 0; i < 50 && state.logs.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    expect(state.logs[0]).toMatchObject({ kind: "investment_decision", startupId: "s1", meta: expect.objectContaining({ status: "accepted" }) });
  });
});


describe("data-integrity fixes (Phase 2)", () => {
  it("2a: editing a startup with a partial payload never nulls the missing fields", async () => {
    const updates: any[] = [];
    Object.assign(fake.storage, {
      getUserById: async (id: string) =>
        id === "admin1"
          ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
          : { id, email: "f@x.io", role: "startup", isActive: true },
      getOwnedStartup: async (id: string) => ({ id, userId: "u9", companyName: "Acme" }),
      updateStartup: async (id: string, data: any) => {
        updates.push(data);
        return { id, ...data };
      },
    });
    // The Edit Startup form's real payload: 8 fields, nothing else.
    const res = await fetch(`${base}/api/startups/s1`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-user": "u9" },
      body: JSON.stringify({
        companyName: "Acme",
        shortDescription: "Solar",
        location: "Tunisia",
        markets: ["Climate"],
        stage: "growth",
        website: "https://acme.io",
        links: { linkedin: "https://linkedin.com/company/acme" },
        deckUrl: "/uploads/decks/s1.pdf?v=1",
      }),
    });
    expect(res.status).toBe(200);
    const written = updates[0];
    expect(written.companyName).toBe("Acme");
    // The fields the form did NOT send must not appear in the update at all.
    for (const key of ["startedYear", "amountRaised", "revenueLastMonth", "isRaising", "productVideoUrl", "isProfitable", "customerTypes"]) {
      expect(Object.prototype.hasOwnProperty.call(written, key), key).toBe(false);
    }
  });

  it("2b: the Initial Data schema accepts the onboarding deck's relative path", async () => {
    const { startupProfileOverviewSchema } = await import("@shared/schema");
    const relative = startupProfileOverviewSchema.safeParse({ deckUrl: "/uploads/decks/abc.pdf?v=123" });
    expect(relative.success).toBe(true);
    const absolute = startupProfileOverviewSchema.safeParse({ deckUrl: "https://docs.example.com/deck" });
    expect(absolute.success).toBe(true);
    const garbage = startupProfileOverviewSchema.safeParse({ deckUrl: "not a link" });
    expect(garbage.success).toBe(false);
  });

  it("2f: a Google-only account editing just the first name keeps the surname", async () => {
    const updates: any[] = [];
    Object.assign(fake.storage, {
      getUserById: async (id: string) =>
        id === "admin1"
          ? { id, email: "admin@open-startup.org", role: "admin", isActive: true }
          : { id, email: "g@x.io", role: "startup", isActive: true, name: "Ghazi Dhouib", firstName: null, lastName: null },
      updateAccount: async (id: string, data: any) => {
        updates.push(data);
        return { id, email: "g@x.io", ...data };
      },
    });
    const res = await fetch(`${base}/api/account`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-user": "u9" },
      body: JSON.stringify({ firstName: "Ghazi-Updated" }),
    });
    expect(res.status).toBe(200);
    expect(updates[0].name).toBe("Ghazi-Updated Dhouib");
  });
});
