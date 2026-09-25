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
  return { users, clients, tokens, notices };
});

vi.mock("./mailer", () => ({
  sendMcpConnectedNotice: async (opts: any) => {
    fake.notices.push(opts);
  },
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
      return { id: t.id, userId: t.userId, clientId: t.clientId, expiresAt: t.expiresAt, userRole: u.role, userActive: u.isActive, userEmail: u.email };
    },
    deleteMcpToken: async (id: string) => {
      const i = fake.tokens.findIndex((x) => x.id === id);
      if (i >= 0) fake.tokens.splice(i, 1);
    },
    countStartups: async () => 7,
    countMcpConnections: async (userId: string) => new Set(fake.tokens.filter((t) => t.userId === userId).map((t) => t.clientId)).size,
    deleteMcpTokensForUser: async (userId: string) => {
      for (let i = fake.tokens.length - 1; i >= 0; i--) if (fake.tokens[i].userId === userId) fake.tokens.splice(i, 1);
    },
  },
}));

const { registerMcp } = await import("./mcp");

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
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
    expect(list.result.tools.every((t: any) => t.annotations.readOnlyHint === true)).toBe(true);

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
