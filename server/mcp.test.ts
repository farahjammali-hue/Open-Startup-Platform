// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import crypto from "crypto";
import type { AddressInfo } from "net";
import type { Server as HttpServer } from "http";

// In-memory stand-in for the database, so these tests exercise the real
// connector + OAuth code over real HTTP without needing Postgres.
const fake = vi.hoisted(() => {
  const users = new Map<string, { id: string; name?: string; email: string; role: string | null; isActive: boolean }>();
  const clients = new Map<string, any>();
  const tokens: any[] = [];
  const notices: any[] = [];
  const sessions = new Map<string, any>();
  const notes = new Map<string, any>();
  const audit: any[] = [];
  const trainingSessions = new Map<string, any>();
  const trainingNotes = new Map<string, any>();
  const metricEntries: any[] = [];
  const broadcasts: any[] = [];
  const messageLog: any[] = [];
  const createdSessions: any[] = [];
  return { users, clients, tokens, notices, sessions, notes, audit, trainingSessions, trainingNotes, metricEntries, broadcasts, messageLog, createdSessions };
});

vi.mock("./mailer", () => ({
  sendMcpConnectedNotice: async (opts: any) => {
    fake.notices.push(opts);
  },
  sendAdminBroadcast: async (opts: any) => {
    fake.broadcasts.push(opts);
    return opts.recipients.length;
  },
  sendSessionInvite: async () => 0,
}));

vi.mock("./transcripts", () => ({
  readTranscriptFile: (url: string) => (url === "/uploads/transcripts/s1.vtt" ? "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nMentor: Ship the pilot.\n" : null),
  vttToPlainText: (vtt: string) => vtt.split("\n").filter((l) => l.includes(":") && !l.includes("-->")).join("\n"),
}));

vi.mock("./storage", () => ({
  storage: {
    getUserById: async (id: string) => fake.users.get(id),
    getMcpClient: async (clientId: string) => fake.clients.get(clientId),
    createMcpClient: async (data: any) => {
      fake.clients.set(data.clientId, data);
      return data;
    },
    createMcpToken: async (data: any) => {
      fake.tokens.push({ id: crypto.randomUUID(), ...data });
    },
    findMcpToken: async (tokenHash: string, kind: string) => {
      const t = fake.tokens.find((x) => x.tokenHash === tokenHash && x.kind === kind && x.expiresAt > new Date());
      if (!t) return undefined;
      const u = fake.users.get(t.userId)!;
      return { id: t.id, userId: t.userId, clientId: t.clientId, expiresAt: t.expiresAt, scope: t.scope ?? "platform:read", userRole: u.role, userActive: u.isActive, userEmail: u.email };
    },
    deleteMcpToken: async (id: string) => {
      const i = fake.tokens.findIndex((x) => x.id === id);
      if (i >= 0) fake.tokens.splice(i, 1);
    },
    countStartups: async () => 7,
    getMentorshipModuleSessionById: async (id: string) => fake.sessions.get(id),
    getMentorshipSessionNotes: async (sessionId: string, startupId: string) => fake.notes.get(`${sessionId}:${startupId}`),
    logMcpAudit: async (row: any) => {
      fake.audit.push(row);
    },
    upsertMentorshipSessionNotes: async (sessionId: string, startupId: string, data: any) => {
      const key = `${sessionId}:${startupId}`;
      const row = { ...(fake.notes.get(key) ?? {}), sessionId, startupId, ...data };
      fake.notes.set(key, row);
      return row;
    },
    // B2 surface: training recaps, metric entry, session completion.
    getTrainingModuleSessionById: async (id: string) => fake.trainingSessions.get(id),
    listStartupIdsVisibleToTrainingSession: async (id: string) => fake.trainingSessions.get(id)?.visibleTo ?? [],
    getTrainingSessionNotes: async (sessionId: string, startupId: string) => fake.trainingNotes.get(`${sessionId}:${startupId}`),
    upsertTrainingSessionNotes: async (sessionId: string, startupId: string, data: any) => {
      const key = `${sessionId}:${startupId}`;
      const row = { ...(fake.trainingNotes.get(key) ?? {}), sessionId, startupId, ...data };
      fake.trainingNotes.set(key, row);
      return row;
    },
    listTrainingSessionsForConnector: async () => [...fake.trainingSessions.values()].map((t) => ({ sessionId: t.id, title: t.title, transcriptUrl: t.transcriptUrl ?? null, recapSavedAt: null })),
    getStartupById: async (id: string) => (id === "44444444-5555-4666-8777-888888888888" ? { id, companyName: "Acme", userId: "u1" } : undefined),
    listMetricEntries: async () => fake.metricEntries,
    upsertMetricEntry: async (startupId: string, period: string, values: any) => {
      const existing = fake.metricEntries.find((e) => e.startupId === startupId && e.period === period);
      if (existing) existing.values = { ...existing.values, ...values };
      else fake.metricEntries.push({ startupId, period, values });
      return fake.metricEntries[fake.metricEntries.length - 1];
    },
    updateMentorshipModuleSession: async (id: string, data: any) => {
      Object.assign(fake.sessions.get(id) ?? {}, data);
      return fake.sessions.get(id);
    },
    updateTrainingModuleSession: async (id: string, data: any) => {
      Object.assign(fake.trainingSessions.get(id) ?? {}, data);
      return fake.trainingSessions.get(id);
    },
    // B3 surface: connector messaging + scheduling.
    getUserByEmail: async (email: string) => [...fake.users.values()].find((u) => u.email === email),
    listStartupMessageRecipients: async () => [{ email: "founder@acme.io", name: "Amina" }],
    listCohortMessageRecipients: async (track: string) => (track === "pre_seed" ? [] : [{ email: "a@x.io", name: null }, { email: "b@x.io", name: null }]),
    logMessage: async (row: any) => fake.messageLog.push(row),
    listMentorshipSessionsForStartup: async () => [{ number: 3 }],
    listTrainingModulesWithSessions: async () => [{ id: "77777777-8888-4999-8aaa-bbbbbbbbbbbb", title: "GTM", track: "all", sessions: [{}, {}] }],
    getTrainingModuleById: async (id: string) => (id === "77777777-8888-4999-8aaa-bbbbbbbbbbbb" ? { id, title: "GTM", track: "all" } : undefined),
    listTrainingModuleSessionsByModule: async () => [{ number: 5 }],
    createMentorshipModuleSession: async (data: any) => {
      const row = { id: "99999999-1111-4222-8333-444444444444", calendarSequence: 0, ...data };
      fake.createdSessions.push({ kind: "mentorship", ...row });
      return row;
    },
    createTrainingModuleSession: async (moduleId: string, data: any) => {
      const row = { id: "99999999-2222-4333-8444-555555555555", moduleId, calendarSequence: 0, ...data };
      fake.createdSessions.push({ kind: "training", ...row });
      return row;
    },
    setMentorshipSessionStartups: async () => {},
    setTrainingSessionStartups: async () => {},
    countMcpConnections: async (userId: string) => new Set(fake.tokens.filter((t) => t.userId === userId).map((t) => t.clientId)).size,
    deleteMcpTokensForUser: async (userId: string) => {
      for (let i = fake.tokens.length - 1; i >= 0; i--) if (fake.tokens[i].userId === userId) fake.tokens.splice(i, 1);
    },
  },
}));

const { registerMcp } = await import("./mcp");
const { __resetMcpSendLimiter } = await import("./aiTools");

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const SESSION_ID = "11111111-2222-4333-8444-555555555555";
const TRAINING_ID = "33333333-4444-4555-8666-777777777777";
const STARTUP_UUID = "44444444-5555-4666-8777-888888888888";
let server: HttpServer;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Stand-in for the platform's login session: which user is signed in.
  app.use((req, _res, next) => {
    (req as any).session = { userId: req.header("x-test-user") };
    next();
  });
  registerMcp(app);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

beforeEach(() => {
  fake.users.clear();
  fake.clients.clear();
  fake.tokens.length = 0;
  fake.notices.length = 0;
  fake.sessions.clear();
  fake.notes.clear();
  fake.sessions.set(SESSION_ID, { id: SESSION_ID, startupId: "startup-1", title: "Go-to-market review", scheduledAt: new Date(), transcriptUrl: "/uploads/transcripts/s1.vtt", status: "upcoming" });
  fake.trainingSessions.clear();
  fake.trainingNotes.clear();
  fake.metricEntries.length = 0;
  fake.broadcasts.length = 0;
  fake.messageLog.length = 0;
  fake.createdSessions.length = 0;
  __resetMcpSendLimiter();
  fake.trainingSessions.set(TRAINING_ID, { id: TRAINING_ID, title: "Fundraising 101", scheduledAt: new Date(), transcriptUrl: "/uploads/transcripts/s1.vtt", status: "upcoming", visibleTo: ["startup-1", "startup-2"] });
  fake.users.set("admin", { id: "admin", email: "ghazi@open-startup.org", role: "admin", isActive: true });
  fake.users.set("gmail-admin", { id: "gmail-admin", email: "someone@gmail.com", role: "admin", isActive: true });
  fake.users.set("founder", { id: "founder", email: "founder@open-startup.org", role: "startup", isActive: true });
  fake.users.set("disabled", { id: "disabled", email: "old@open-startup.org", role: "admin", isActive: false });
});

const pkce = () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
};

async function registerClient(redirectUri = CLAUDE_CALLBACK) {
  return fetch(`${base}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none", client_name: "Claude" }),
  });
}

async function authorizePage(clientId: string, challenge: string, user?: string) {
  const qs = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: CLAUDE_CALLBACK,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "state-123",
  });
  return fetch(`${base}/oauth/authorize?${qs}`, { headers: user ? { "x-test-user": user } : {} });
}

/** Full approval as `user`, returning the authorization code. */
async function approve(clientId: string, challenge: string, user = "admin") {
  const html = await (await authorizePage(clientId, challenge, user)).text();
  const consentId = html.match(/name="consent_id" value="([^"]+)"/)?.[1];
  expect(consentId).toBeTruthy();
  const res = await fetch(`${base}/oauth/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-test-user": user },
    body: new URLSearchParams({ consent_id: consentId!, decision: "allow" }),
  });
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location")!);
  expect(`${location.origin}${location.pathname}`).toBe(CLAUDE_CALLBACK);
  expect(location.searchParams.get("state")).toBe("state-123");
  return location.searchParams.get("code")!;
}

async function exchange(params: Record<string, string>) {
  return fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
}

async function connect(user = "admin") {
  const { client_id } = await (await registerClient()).json();
  const { verifier, challenge } = pkce();
  const code = await approve(client_id, challenge, user);
  const tokens = await (
    await exchange({ grant_type: "authorization_code", code, redirect_uri: CLAUDE_CALLBACK, client_id, code_verifier: verifier })
  ).json();
  return { clientId: client_id, ...tokens };
}

async function mcp(accessToken: string | undefined, method: string, params: object = {}) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("Claude connector: happy path", () => {
  it("publishes discovery documents", async () => {
    const pr = await (await fetch(`${base}/.well-known/oauth-protected-resource`)).json();
    expect(pr.authorization_servers).toHaveLength(1);
    const as = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.registration_endpoint).toMatch(/\/oauth\/register$/);
  });

  it("lets an @open-startup.org admin connect, list tools and run a lookup", async () => {
    const { access_token, refresh_token, token_type } = await connect();
    expect(token_type).toBe("Bearer");
    expect(access_token).toBeTruthy();
    expect(refresh_token).toBeTruthy();

    const init = await (
      await mcp(access_token, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      })
    ).json();
    expect(init.result.serverInfo.name).toBe("open-startup-platform");

    const list = await (await mcp(access_token, "tools/list")).json();
    const names = list.result.tools.map((t: any) => t.name);
    expect(names).toContain("list_startups");
    const writers = list.result.tools.filter((t: any) => t.annotations.readOnlyHint !== true).map((t: any) => t.name);
    expect(writers.sort()).toEqual([
      "complete_session",
      "record_startup_metrics",
      "save_session_recap",
      "save_training_recap",
      "schedule_mentorship_session",
      "schedule_training_session",
      "send_cohort_message",
      "send_startup_message",
    ]);

    const call = await (await mcp(access_token, "tools/call", { name: "count_startups", arguments: {} })).json();
    expect(JSON.parse(call.result.content[0].text)).toEqual({ count: 7 });
  });

  it("stores tokens only as hashes", async () => {
    const { access_token, refresh_token } = await connect();
    const stored = fake.tokens.map((t) => t.tokenHash);
    expect(stored).not.toContain(access_token);
    expect(stored).not.toContain(refresh_token);
  });
});

describe("Claude connector: who can connect", () => {
  it("sends signed-out visitors to sign in instead of approving", async () => {
    const { client_id } = await (await registerClient()).json();
    const html = await (await authorizePage(client_id, pkce().challenge)).text();
    expect(html).toContain("Sign in to continue");
    expect(html).not.toContain("consent_id");
  });

  for (const [user, why] of [
    ["gmail-admin", "an admin outside @open-startup.org"],
    ["founder", "a founder account, even on the company domain"],
    ["disabled", "a disabled admin"],
  ]) {
    it(`refuses ${why}`, async () => {
      const { client_id } = await (await registerClient()).json();
      const res = await authorizePage(client_id, pkce().challenge, user);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("consent_id");
    });
  }

  it("won't let one admin submit an approval that was shown to another", async () => {
    fake.users.set("admin2", { id: "admin2", email: "other@open-startup.org", role: "admin", isActive: true });
    const { client_id } = await (await registerClient()).json();
    const html = await (await authorizePage(client_id, pkce().challenge, "admin")).text();
    const consentId = html.match(/name="consent_id" value="([^"]+)"/)![1];
    const res = await fetch(`${base}/oauth/authorize`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "x-test-user": "admin2" },
      body: new URLSearchParams({ consent_id: consentId, decision: "allow" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Claude connector: phishing and stolen credentials", () => {
  it("rejects apps that want approvals sent anywhere but Claude", async () => {
    for (const uri of [
      "https://evil.example.com/callback",
      "https://claude.ai.evil.example.com/cb",
      "http://claude.ai/api/mcp/auth_callback",
      "javascript:alert(1)",
    ]) {
      expect((await registerClient(uri)).status).toBe(400);
    }
    // Local callbacks (Claude Desktop / Claude Code) are fine.
    expect((await registerClient("http://localhost:33418/callback")).status).toBe(201);
  });

  it("refuses an approval link whose return address doesn't match the registered one", async () => {
    const { client_id } = await (await registerClient()).json();
    const qs = new URLSearchParams({
      response_type: "code",
      client_id,
      redirect_uri: "https://claude.com/other",
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
    });
    const res = await fetch(`${base}/oauth/authorize?${qs}`, { headers: { "x-test-user": "admin" } });
    expect(res.status).toBe(400);
  });

  it("requires the PKCE proof, and each code works only once", async () => {
    const { client_id } = await (await registerClient()).json();
    const { verifier, challenge } = pkce();
    const code = await approve(client_id, challenge);
    const wrong = await exchange({ grant_type: "authorization_code", code, redirect_uri: CLAUDE_CALLBACK, client_id, code_verifier: pkce().verifier });
    expect(wrong.status).toBe(400);
    // The failed attempt burned the code, so even the right proof fails now.
    const retry = await exchange({ grant_type: "authorization_code", code, redirect_uri: CLAUDE_CALLBACK, client_id, code_verifier: verifier });
    expect(retry.status).toBe(400);
  });

  it("won't hand a code to a different app than the one approved", async () => {
    const { client_id } = await (await registerClient()).json();
    const other = (await (await registerClient()).json()).client_id;
    const { verifier, challenge } = pkce();
    const code = await approve(client_id, challenge);
    const res = await exchange({ grant_type: "authorization_code", code, redirect_uri: CLAUDE_CALLBACK, client_id: other, code_verifier: verifier });
    expect(res.status).toBe(400);
  });

  it("rejects requests without a valid token, and says where to sign in", async () => {
    const none = await mcp(undefined, "tools/list");
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect((await mcp("made-up-token", "tools/list")).status).toBe(401);
  });

  it("rotates refresh tokens: an old one stops working after use", async () => {
    const { clientId, refresh_token } = await connect();
    const first = await exchange({ grant_type: "refresh_token", refresh_token, client_id: clientId });
    expect(first.status).toBe(200);
    const replay = await exchange({ grant_type: "refresh_token", refresh_token, client_id: clientId });
    expect(replay.status).toBe(400);
  });
});

describe("Claude connector: access is re-checked on every request", () => {
  it("cuts off an admin the moment they're disabled or lose admin rights", async () => {
    const { access_token, clientId, refresh_token } = await connect();
    expect((await mcp(access_token, "tools/list")).status).toBe(200);

    fake.users.get("admin")!.role = "startup";
    expect((await mcp(access_token, "tools/list")).status).toBe(401);
    expect((await exchange({ grant_type: "refresh_token", refresh_token, client_id: clientId })).status).toBe(400);

    fake.users.get("admin")!.role = "admin";
    fake.users.get("admin")!.isActive = false;
    expect((await mcp(access_token, "tools/list")).status).toBe(401);
  });

  it("cuts off an admin whose email moves off the company domain", async () => {
    const { access_token } = await connect();
    fake.users.get("admin")!.email = "ghazi@gmail.com";
    expect((await mcp(access_token, "tools/list")).status).toBe(401);
  });
});

describe("Claude connector: noticing and stopping a connection", () => {
  it("emails the admin every time Claude is connected to their account", async () => {
    await connect();
    expect(fake.notices).toHaveLength(1);
    expect(fake.notices[0].to).toBe("ghazi@open-startup.org");
  });

  it("\"Disconnect Claude\" instantly revokes every connection for that admin", async () => {
    const { access_token, refresh_token, clientId } = await connect();
    const status = await (await fetch(`${base}/api/admin/mcp-connector`, { headers: { "x-test-user": "admin" } })).json();
    expect(status).toMatchObject({ allowed: true, connections: 1 });

    const res = await fetch(`${base}/api/admin/mcp-connector/connections`, { method: "DELETE", headers: { "x-test-user": "admin" } });
    expect(res.status).toBe(200);
    expect((await mcp(access_token, "tools/list")).status).toBe(401);
    expect((await exchange({ grant_type: "refresh_token", refresh_token, client_id: clientId })).status).toBe(400);
  });

  it("reports non-company-domain admins as not allowed to connect", async () => {
    const status = await (await fetch(`${base}/api/admin/mcp-connector`, { headers: { "x-test-user": "gmail-admin" } })).json();
    expect(status.allowed).toBe(false);
  });
});

const RECAP = {
  teamMembersPresence: "Amara, Tunde, Ivy",
  progressHighlights: "- Pilot signed",
  mentorComments: "- Ship the pilot",
  needsHighlighted: "None noted",
  nextMeetingCheckIns: "- Pilot results",
  actionItemsForOst: "- Intro to PanAfricom",
};

async function callTool(accessToken: string, name: string, args: object) {
  const body = await (await mcp(accessToken, "tools/call", { name, arguments: args })).json();
  return { isError: body.result.isError === true, data: JSON.parse(body.result.content[0].text) };
}

describe("Claude connector: session recaps (the only write)", () => {
  it("lists sessions and returns a readable transcript", async () => {
    const { access_token } = await connect();
    const t = await callTool(access_token, "get_session_transcript", { sessionId: SESSION_ID });
    expect(t.isError).toBe(false);
    expect(t.data.transcript).toContain("Mentor: Ship the pilot.");
    expect(t.data.transcript).not.toContain("-->");
  });

  it("saves a recap for a new connection, attributed in the notes", async () => {
    const { access_token } = await connect();
    const saved = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    expect(saved).toMatchObject({ isError: false, data: { ok: true, replacedExisting: false } });
    const row = fake.notes.get(`${SESSION_ID}:startup-1`);
    expect(row.progressHighlights).toBe("- Pilot signed");
    expect(row.aiGeneratedAt).toBeInstanceOf(Date);
  });

  it("won't replace an existing recap unless explicitly told to", async () => {
    const { access_token } = await connect();
    await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    const again = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP, mentorComments: "- changed" });
    expect(again.isError).toBe(true);
    expect(fake.notes.get(`${SESSION_ID}:startup-1`).mentorComments).toBe("- Ship the pilot");
    const replaced = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP, mentorComments: "- changed", overwrite: true });
    expect(replaced.data.replacedExisting).toBe(true);
    expect(fake.notes.get(`${SESSION_ID}:startup-1`).mentorComments).toBe("- changed");
  });

  it("keeps connections approved before recap-saving read-only until reconnected", async () => {
    const { access_token } = await connect();
    // Simulate a token issued under the old read-only approval.
    for (const t of fake.tokens) t.scope = "platform:read";
    const res = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    expect(res.isError).toBe(true);
    expect(res.data.error).toMatch(/reconnect/i);
    expect(fake.notes.size).toBe(0);
    // Reads still work.
    expect((await callTool(access_token, "count_startups", {})).data).toEqual({ count: 7 });
  });

  it("keeps the old grant when a read-only connection refreshes", async () => {
    const { clientId, refresh_token } = await connect();
    for (const t of fake.tokens) t.scope = "platform:read";
    const renewed = await (await exchange({ grant_type: "refresh_token", refresh_token, client_id: clientId })).json();
    expect(renewed.scope).toBe("platform:read");
    const res = await callTool(renewed.access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    expect(res.isError).toBe(true);
  });

  it("rejects incomplete, oversized or malformed recaps", async () => {
    const { access_token } = await connect();
    const missing = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, progressHighlights: "x" });
    expect(missing.isError).toBe(true);
    const huge = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP, mentorComments: "x".repeat(7000) });
    expect(huge.isError).toBe(true);
    const badId = await callTool(access_token, "save_session_recap", { sessionId: "../../etc/passwd", ...RECAP });
    expect(badId.isError).toBe(true);
    expect(fake.notes.size).toBe(0);
  });

  it("says upfront on the approval page that recaps can be saved", async () => {
    const { client_id } = await (await registerClient()).json();
    const html = await (await authorizePage(client_id, pkce().challenge, "admin")).text();
    expect(html).toContain("Save mentorship and training session recaps");
    expect(html).toContain("Record a startup&#39;s monthly metrics");
    expect(html).not.toContain("No ability to change anything");
  });
});

describe("audit log (B1)", () => {
  it("every tool call writes a durable audit row, reads and writes alike", async () => {
    fake.audit.length = 0;
    const { access_token } = await connect();
    await callTool(access_token, "count_startups", {});
    const okRow = fake.audit.find((r) => r.tool === "count_startups");
    expect(okRow).toMatchObject({ userEmail: "ghazi@open-startup.org", ok: true });

    await callTool(access_token, "get_startup_profile", { startupId: "not-a-uuid" });
    const errRow = fake.audit.find((r) => r.tool === "get_startup_profile");
    expect(errRow.ok).toBe(false);
    expect(errRow.error).toMatch(/startupId/);
    expect(errRow.input).toEqual({ startupId: "not-a-uuid" });
  });

  it("a scope denial is audited as a failure", async () => {
    fake.audit.length = 0;
    const { access_token } = await connect();
    for (const t of fake.tokens) t.scope = "platform:read";
    await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    const row = fake.audit.find((r) => r.tool === "save_session_recap");
    expect(row.ok).toBe(false);
    expect(row.error).toMatch(/recaps:write/);
  });
});

describe("wave-1 write tools (B2)", () => {
  it("saves a training recap to every startup the session is visible to", async () => {
    const { access_token } = await connect();
    const res = await callTool(access_token, "save_training_recap", { sessionId: TRAINING_ID, ...RECAP });
    expect(res.data).toMatchObject({ ok: true, savedForStartups: 2, replacedExisting: false });
    expect(fake.trainingNotes.get(`${TRAINING_ID}:startup-1`).mentorComments).toBe(RECAP.mentorComments);
    expect(fake.trainingNotes.get(`${TRAINING_ID}:startup-2`).aiGeneratedAt).toBeInstanceOf(Date);
    // Second save without overwrite is refused; nothing changes.
    const again = await callTool(access_token, "save_training_recap", { sessionId: TRAINING_ID, ...RECAP, mentorComments: "- changed" });
    expect(again.isError).toBe(true);
    expect(fake.trainingNotes.get(`${TRAINING_ID}:startup-1`).mentorComments).toBe(RECAP.mentorComments);
  });

  it("records metrics with a before/after diff and rejects unknown keys", async () => {
    const { access_token } = await connect();
    fake.metricEntries.push({ startupId: STARTUP_UUID, period: "2026-09", values: { rev_cumulative: 100 } });
    const bad = await callTool(access_token, "record_startup_metrics", { startupId: STARTUP_UUID, period: "2026-09", values: { made_up_metric: 5 } });
    expect(bad.isError).toBe(true);
    expect(bad.data.error).toContain("made_up_metric");
    const ok = await callTool(access_token, "record_startup_metrics", { startupId: STARTUP_UUID, period: "2026-09", values: { rev_cumulative: 250, hr_team_size: 6 } });
    expect(ok.data).toMatchObject({ ok: true, startup: "Acme", before: { rev_cumulative: 100, hr_team_size: null }, after: { rev_cumulative: 250, hr_team_size: 6 } });
    expect(fake.metricEntries[0].values).toEqual({ rev_cumulative: 250, hr_team_size: 6 });
    const badPeriod = await callTool(access_token, "record_startup_metrics", { startupId: STARTUP_UUID, period: "2026-13", values: { rev_cumulative: 1 } });
    expect(badPeriod.isError).toBe(true);
  });

  it("completes a session of either kind, idempotently", async () => {
    const { access_token } = await connect();
    const first = await callTool(access_token, "complete_session", { sessionId: SESSION_ID });
    expect(first.data).toMatchObject({ ok: true, kind: "mentorship", alreadyCompleted: false });
    expect(fake.sessions.get(SESSION_ID).status).toBe("completed");
    const second = await callTool(access_token, "complete_session", { sessionId: SESSION_ID });
    expect(second.data.alreadyCompleted).toBe(true);
    const training = await callTool(access_token, "complete_session", { sessionId: TRAINING_ID });
    expect(training.data).toMatchObject({ kind: "training" });
  });

  it("old tokens without the new scopes are denied the new writes but keep recaps", async () => {
    const { access_token } = await connect();
    for (const t of fake.tokens) t.scope = "platform:read recaps:write";
    const metrics = await callTool(access_token, "record_startup_metrics", { startupId: STARTUP_UUID, period: "2026-09", values: { rev_cumulative: 1 } });
    expect(metrics.isError).toBe(true);
    expect(metrics.data.error).toContain("metrics:write");
    const complete = await callTool(access_token, "complete_session", { sessionId: SESSION_ID });
    expect(complete.isError).toBe(true);
    const recap = await callTool(access_token, "save_session_recap", { sessionId: SESSION_ID, ...RECAP });
    expect(recap.data.ok).toBe(true);
  });
});

describe("wave-2: messaging + scheduling (B3)", () => {
  const MODULE_ID = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";

  it("messages are dry-run by default: full preview, nothing sent, nothing logged", async () => {
    const { access_token } = await connect();
    const res = await callTool(access_token, "send_startup_message", { startupId: STARTUP_UUID, subject: "Hi", body: "Quick note" });
    expect(res.data).toMatchObject({ dryRun: true, wouldSendTo: ["founder@acme.io"], subject: "Hi", audience: "Acme" });
    expect(fake.broadcasts).toHaveLength(0);
    expect(fake.messageLog).toHaveLength(0);
  });

  it("confirm:true sends, logs as mcp:<email>, and pings ops", async () => {
    const { access_token } = await connect();
    const res = await callTool(access_token, "send_cohort_message", { track: "seed", subject: "Office hours", body: "Thursday 3pm", confirm: true });
    expect(res.data).toMatchObject({ ok: true, sentTo: 2, delivered: 2 });
    expect(fake.broadcasts[0].recipients).toHaveLength(2);
    expect(fake.messageLog[0]).toMatchObject({ kind: "cohort_message", sentBy: "mcp:ghazi@open-startup.org", meta: expect.objectContaining({ track: "seed" }) });
  });

  it("an empty audience is an error, not a silent no-op", async () => {
    const { access_token } = await connect();
    const res = await callTool(access_token, "send_cohort_message", { track: "pre_seed", subject: "S", body: "B", confirm: true });
    expect(res.isError).toBe(true);
  });

  it("rate-limits confirmed sends per admin", async () => {
    const { access_token } = await connect();
    for (let i = 0; i < 10; i++) {
      const r = await callTool(access_token, "send_startup_message", { startupId: STARTUP_UUID, subject: `S${i}`, body: "B", confirm: true });
      expect(r.data.ok).toBe(true);
    }
    const eleventh = await callTool(access_token, "send_startup_message", { startupId: STARTUP_UUID, subject: "S11", body: "B", confirm: true });
    expect(eleventh.isError).toBe(true);
    expect(eleventh.data.error).toMatch(/rate limit/i);
    expect(fake.messageLog).toHaveLength(10);
  });

  it("schedules a mentorship session with the next number and returns the join link", async () => {
    const { access_token } = await connect();
    const res = await callTool(access_token, "schedule_mentorship_session", {
      startupId: STARTUP_UUID,
      title: "Pricing deep-dive",
      scheduledAt: "2026-10-02T14:00:00Z",
    });
    expect(res.data).toMatchObject({ ok: true, startup: "Acme", number: 4, joinUrl: null });
    expect(fake.createdSessions[0]).toMatchObject({ kind: "mentorship", startupId: STARTUP_UUID, durationMinutes: 120, status: "upcoming" });
  });

  it("schedules a training session under a module found via list_training_modules", async () => {
    const { access_token } = await connect();
    const modules = await callTool(access_token, "list_training_modules", {});
    expect(modules.data[0]).toMatchObject({ id: MODULE_ID, title: "GTM" });
    const res = await callTool(access_token, "schedule_training_session", { moduleId: MODULE_ID, title: "GTM part 2", scheduledAt: "2026-10-05T10:00:00Z" });
    expect(res.data).toMatchObject({ ok: true, module: "GTM", number: 6 });
    const bad = await callTool(access_token, "schedule_training_session", { moduleId: MODULE_ID, title: "x", scheduledAt: "not-a-date" });
    expect(bad.isError).toBe(true);
  });

  it("old tokens without messages:write are denied sends", async () => {
    const { access_token } = await connect();
    for (const t of fake.tokens) t.scope = "platform:read recaps:write";
    const res = await callTool(access_token, "send_startup_message", { startupId: STARTUP_UUID, subject: "S", body: "B", confirm: true });
    expect(res.isError).toBe(true);
    expect(res.data.error).toContain("messages:write");
  });
});
