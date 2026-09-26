import type { Express, NextFunction, Request, Response } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { storage } from "./storage";
import { AI_TOOLS, SCOPE_REGISTRY, executeAiTool } from "./aiTools";
import { sendMcpConnectedNotice } from "./mailer";

/**
 * Claude connector: a remote MCP server at /mcp that lets an admin's own
 * Claude (claude.ai, Desktop, Cowork) read platform data through the
 * curated, read-only lookups in server/aiTools.ts. Usage runs on the team's
 * Claude seats, not on API credits.
 *
 * Claude requires OAuth for custom connectors, so this also implements a
 * small OAuth 2.1 authorization server (dynamic client registration,
 * authorization code + PKCE S256, refresh tokens). Approval happens on a
 * platform page and requires a logged-in, active admin. Written directly on
 * this Express 4 app rather than via the SDK's auth router, which is built
 * on Express 5.
 */

const APP_URL = (process.env.APP_URL || "http://localhost:5000").replace(/\/+$/, "");
const MCP_URL = `${APP_URL}/mcp`;
// What an admin grants by clicking Allow on the approval page — the page's
// bullet list, both discovery documents and the server instructions are all
// generated from SCOPE_REGISTRY (server/aiTools.ts), so they can't drift.
// MCP_GRANTED_SCOPES (space-separated, optional) narrows what NEW connections
// are granted; unknown ids are ignored. Existing connections always keep the
// scope they were approved with until the admin reconnects.
const GRANTED_SCOPES: string[] = (() => {
  const known = SCOPE_REGISTRY.map((s) => s.id);
  const fromEnv = (process.env.MCP_GRANTED_SCOPES ?? "").split(/\s+/).filter(Boolean);
  const chosen = fromEnv.length > 0 ? fromEnv.filter((s) => known.includes(s)) : known;
  return chosen.length > 0 ? chosen : known;
})();
const GRANTED_SCOPE = GRANTED_SCOPES.join(" ");
const ACCESS_TTL_S = 60 * 60; // 1 hour
const REFRESH_TTL_S = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000;

// Who may use the connector at all: active admins whose email is on one of
// these domains. Checked at approval, at every token exchange/refresh, and on
// every single MCP request, so revoking admin rights cuts access immediately.
const ALLOWED_EMAIL_DOMAINS = (process.env.MCP_ALLOWED_EMAIL_DOMAINS || "open-startup.org")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// Where approvals may be sent back to: Claude's own callback hosts, plus local
// callbacks for Claude Desktop / Claude Code. Blocks consent phishing, where an
// attacker registers their own "app" and tricks an admin into approving it.
const ALLOWED_REDIRECT_HOSTS = (process.env.MCP_ALLOWED_REDIRECT_HOSTS || "claude.ai,claude.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function isAllowedConnectorUser(user: { email: string; role: string | null; isActive: boolean } | undefined | null): boolean {
  if (!user || !user.isActive || user.role !== "admin") return false;
  const email = user.email.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");

// Short-lived and in memory on purpose: a server restart mid-approval only
// means the admin clicks "Connect" again. Issued tokens live in the database.
interface PendingConsent {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  state?: string;
  expiresAt: number;
}
interface AuthCode {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
}
const pendingConsents = new Map<string, PendingConsent>();
const authCodes = new Map<string, AuthCode>();

function sweep() {
  const now = Date.now();
  for (const [key, value] of pendingConsents) if (value.expiresAt < now) pendingConsents.delete(key);
  for (const [key, value] of authCodes) if (value.expiresAt < now) authCodes.delete(key);
}

/** https on an allowed Claude host, or plain http only on the admin's own machine (desktop apps' local callbacks). */
function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === "https:") return ALLOWED_REDIRECT_HOSTS.includes(url.hostname.toLowerCase());
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function withParams(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(res: Response, status: number, title: string, body: string) {
  res
    .status(status)
    .set("Content-Security-Policy", "frame-ancestors 'none'")
    .set("X-Frame-Options", "DENY")
    .set("Cache-Control", "no-store")
    .type("html")
    .send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Open Startup Platform</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#F2EFE9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0A193D}
  main{max-width:440px;margin:12vh auto;padding:0 20px}
  .card{background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(10,25,61,.08)}
  h1{font-size:20px;margin:0 0 12px} p{font-size:14px;line-height:1.6;color:#475569;margin:0 0 12px}
  .brand{font-weight:800;margin-bottom:20px} .muted{font-size:12px;color:#94a3b8}
  .row{display:flex;gap:8px;margin-top:20px}
  button,a.btn{flex:1;text-align:center;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;border:1px solid #cbd5e1;background:#fff;color:#0A193D}
  button.primary,a.primary{background:#0A193D;border-color:#0A193D;color:#fff}
  ul{font-size:14px;color:#475569;padding-left:18px;margin:0 0 12px}
</style></head><body><main><div class="brand">Open Startup Platform</div><div class="card">${body}</div></main></body></html>`);
}

function oauthError(res: Response, status: number, error: string, description: string) {
  res.status(status).set("Cache-Control", "no-store").json({ error, error_description: description });
}

/** The logged-in user, if they're allowed to use the connector. */
async function currentAdmin(req: Request) {
  if (!req.session.userId) return null;
  const user = await storage.getUserById(req.session.userId);
  return isAllowedConnectorUser(user) ? user! : null;
}

async function issueTokens(res: Response, userId: string, clientId: string, scope: string) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  await storage.createMcpToken({
    tokenHash: sha256(accessToken),
    kind: "access",
    scope,
    userId,
    clientId,
    expiresAt: new Date(now + ACCESS_TTL_S * 1000),
  });
  await storage.createMcpToken({
    tokenHash: sha256(refreshToken),
    kind: "refresh",
    scope,
    userId,
    clientId,
    expiresAt: new Date(now + REFRESH_TTL_S * 1000),
  });
  res.set("Cache-Control", "no-store").set("Pragma", "no-cache").json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refreshToken,
    scope,
  });
}

/** Client authentication at the token endpoint: HTTP Basic, form body, or none for public clients. */
async function authenticateClient(req: Request) {
  let clientId = typeof req.body?.client_id === "string" ? req.body.client_id : undefined;
  let clientSecret = typeof req.body?.client_secret === "string" ? req.body.client_secret : undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep > 0) {
      clientId = decodeURIComponent(decoded.slice(0, sep));
      clientSecret = decodeURIComponent(decoded.slice(sep + 1));
    }
  }
  if (!clientId) return null;
  const client = await storage.getMcpClient(clientId);
  if (!client) return null;
  if (client.clientSecretHash) {
    if (!clientSecret) return null;
    const given = Buffer.from(sha256(clientSecret));
    const expected = Buffer.from(client.clientSecretHash);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  }
  return client;
}

function cors(req: Request, res: Response, next: NextFunction) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, mcp-protocol-version, mcp-session-id");
  res.set("Access-Control-Expose-Headers", "WWW-Authenticate, mcp-session-id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
    fn(req, res).catch((error) => {
      console.error("[mcp]", error);
      if (!res.headersSent) res.status(500).json({ error: "server_error", error_description: "Unexpected server error" });
    });

export function registerMcp(app: Express) {
  // Claude calls these from Anthropic's servers, not each admin's machine, so
  // one limit is shared by the whole team: generous enough for everyone, tight
  // enough to stop brute-force or flooding.
  const limiter = (windowMs: number, limit: number) =>
    rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === "test" });
  const registerLimiter = limiter(60 * 60 * 1000, 60);
  const tokenLimiter = limiter(15 * 60 * 1000, 300);
  const mcpLimiter = limiter(60 * 1000, 600);

  /* ---------------- Discovery ---------------- */
  const protectedResource = {
    resource: MCP_URL,
    authorization_servers: [APP_URL],
    scopes_supported: GRANTED_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Open Startup Platform",
  };
  app.all(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"], cors, (_req, res) =>
    res.json(protectedResource),
  );
  app.all("/.well-known/oauth-authorization-server", cors, (_req, res) =>
    res.json({
      issuer: APP_URL,
      authorization_endpoint: `${APP_URL}/oauth/authorize`,
      token_endpoint: `${APP_URL}/oauth/token`,
      registration_endpoint: `${APP_URL}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      scopes_supported: GRANTED_SCOPES,
    }),
  );

  /* ---------------- Dynamic client registration (RFC 7591) ---------------- */
  app.options("/oauth/register", cors);
  app.post("/oauth/register", cors, registerLimiter, handle(async (req, res) => {
    const redirectUris: unknown = req.body?.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10) {
      return oauthError(res, 400, "invalid_redirect_uri", "redirect_uris must be a non-empty list");
    }
    if (!redirectUris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))) {
      return oauthError(res, 400, "invalid_redirect_uri", "Only https (or local http) redirect URIs are allowed");
    }
    const method = req.body?.token_endpoint_auth_method ?? "client_secret_basic";
    if (!["none", "client_secret_basic", "client_secret_post"].includes(method)) {
      return oauthError(res, 400, "invalid_client_metadata", "Unsupported token_endpoint_auth_method");
    }
    const clientName = typeof req.body?.client_name === "string" ? req.body.client_name.slice(0, 100) : null;
    const clientId = `ost_${randomToken()}`;
    const clientSecret = method === "none" ? undefined : randomToken();
    await storage.createMcpClient({
      clientId,
      clientSecretHash: clientSecret ? sha256(clientSecret) : null,
      clientName,
      redirectUris: redirectUris as string[],
    });
    res.status(201).set("Cache-Control", "no-store").json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: method,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: GRANTED_SCOPE,
    });
  }));

  /* ---------------- Authorization (consent page) ---------------- */
  app.get("/oauth/authorize", handle(async (req, res) => {
    sweep();
    const q = req.query as Record<string, string | undefined>;
    const client = q.client_id ? await storage.getMcpClient(String(q.client_id)) : undefined;
    if (!client) {
      return page(res, 400, "Connection error", `<h1>This connection link isn't valid</h1><p>Remove the connector in Claude and add it again.</p>`);
    }
    const redirectUri = q.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      return page(res, 400, "Connection error", `<h1>This connection link isn't valid</h1><p>The return address doesn't match the one Claude registered. Remove the connector in Claude and add it again.</p>`);
    }
    // From here on, errors go back to Claude rather than being shown here.
    if (q.response_type !== "code") {
      return res.redirect(withParams(redirectUri, { error: "unsupported_response_type", state: q.state }));
    }
    if (!q.code_challenge || q.code_challenge_method !== "S256") {
      return res.redirect(withParams(redirectUri, { error: "invalid_request", error_description: "PKCE with S256 is required", state: q.state }));
    }

    if (!req.session.userId) {
      const loginUrl = `/login?next=${encodeURIComponent(req.originalUrl)}`;
      return page(res, 200, "Sign in", `<h1>Sign in to continue</h1>
        <p>To connect Claude to the Open Startup Platform, sign in with your admin account first. You'll come straight back here.</p>
        <div class="row"><a class="btn primary" href="${escapeHtml(loginUrl)}">Sign in</a></div>`);
    }
    const admin = await currentAdmin(req);
    if (!admin) {
      return page(res, 403, "Not allowed", `<h1>Not available for this account</h1><p>Only active Open Startup team admins (${escapeHtml(ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", "))} accounts) can connect Claude to the platform.</p>`);
    }

    const consentId = randomToken();
    pendingConsents.set(consentId, {
      userId: admin.id,
      clientId: client.clientId,
      redirectUri,
      codeChallenge: q.code_challenge,
      scope: GRANTED_SCOPE,
      state: q.state,
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    const appName = client.clientName ? escapeHtml(client.clientName) : "An app";
    return page(res, 200, "Connect Claude", `<h1>Connect to the Open Startup Platform?</h1>
      <p><strong>${appName}</strong> wants to use the platform as <strong>${escapeHtml(admin.email)}</strong>.</p>
      <ul>
        ${SCOPE_REGISTRY.filter((sc) => GRANTED_SCOPES.includes(sc.id)).map((sc) => `<li>${escapeHtml(sc.consent)}</li>`).join("")}
        <li>No access to contract or document files</li>
        <li>Can't change or delete anything else</li>
      </ul>
      <p class="muted">You'll be sent back to ${escapeHtml(new URL(redirectUri).host)}. Only continue if you started this from Claude.</p>
      <form method="post" action="/oauth/authorize">
        <input type="hidden" name="consent_id" value="${consentId}">
        <div class="row">
          <button type="submit" name="decision" value="deny">Cancel</button>
          <button type="submit" name="decision" value="allow" class="primary">Allow</button>
        </div>
      </form>`);
  }));

  app.post("/oauth/authorize", handle(async (req, res) => {
    sweep();
    const consentId = String(req.body?.consent_id ?? "");
    const pending = pendingConsents.get(consentId);
    pendingConsents.delete(consentId);
    // The consent id is random, single-use and bound to the admin who saw the
    // page, so a forged form post from elsewhere can't approve anything.
    if (!pending || pending.userId !== req.session.userId) {
      return page(res, 400, "Expired", `<h1>This approval expired</h1><p>Go back to Claude and click Connect again.</p>`);
    }
    if (req.body?.decision !== "allow") {
      return res.redirect(withParams(pending.redirectUri, { error: "access_denied", state: pending.state }));
    }
    const code = randomToken();
    authCodes.set(sha256(code), {
      userId: pending.userId,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scope: pending.scope,
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    res.redirect(withParams(pending.redirectUri, { code, state: pending.state }));
  }));

  /* ---------------- Token endpoint ---------------- */
  app.options("/oauth/token", cors);
  app.post("/oauth/token", cors, tokenLimiter, handle(async (req, res) => {
    sweep();
    const client = await authenticateClient(req);
    if (!client) return oauthError(res, 401, "invalid_client", "Unknown client or bad client credentials");

    const grantType = req.body?.grant_type;
    if (grantType === "authorization_code") {
      const code = String(req.body?.code ?? "");
      const entry = authCodes.get(sha256(code));
      authCodes.delete(sha256(code)); // single use, even when the exchange fails
      if (!entry || entry.expiresAt < Date.now() || entry.clientId !== client.clientId) {
        return oauthError(res, 400, "invalid_grant", "Authorization code is invalid or expired");
      }
      if (req.body?.redirect_uri && req.body.redirect_uri !== entry.redirectUri) {
        return oauthError(res, 400, "invalid_grant", "redirect_uri does not match");
      }
      const verifier = String(req.body?.code_verifier ?? "");
      const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
      if (!verifier || challenge !== entry.codeChallenge) {
        return oauthError(res, 400, "invalid_grant", "PKCE verification failed");
      }
      const user = await storage.getUserById(entry.userId);
      if (!user || !isAllowedConnectorUser(user)) {
        return oauthError(res, 400, "invalid_grant", "This account can no longer use the connector");
      }
      await issueTokens(res, user.id, client.clientId, entry.scope);
      void sendMcpConnectedNotice({
        to: user.email,
        name: (user.name ?? "").split(" ")[0] || "there",
        appName: client.clientName || "An app",
        disconnectUrl: `${APP_URL}/admin`,
      }).catch((error) => console.error("[mcp] connection notice failed:", error));
      console.log(`[mcp] ${user.email} connected ${client.clientName || client.clientId}`);
      return;
    }

    if (grantType === "refresh_token") {
      const token = await storage.findMcpToken(sha256(String(req.body?.refresh_token ?? "")), "refresh");
      if (!token || token.clientId !== client.clientId || !isAllowedConnectorUser({ email: token.userEmail, role: token.userRole, isActive: token.userActive })) {
        return oauthError(res, 400, "invalid_grant", "Refresh token is invalid or expired");
      }
      await storage.deleteMcpToken(token.id); // rotate: each refresh token works once
      return issueTokens(res, token.userId, client.clientId, token.scope);
    }

    return oauthError(res, 400, "unsupported_grant_type", "Only authorization_code and refresh_token are supported");
  }));

  /* ---------------- Platform-side controls (session-authenticated) ---------------- */
  app.get("/api/admin/mcp-connector", handle(async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await currentAdmin(req);
    res.json({
      url: MCP_URL,
      allowed: !!admin,
      connections: admin ? await storage.countMcpConnections(admin.id) : 0,
    });
  }));

  // Any signed-in user can always cut off their own connections.
  app.delete("/api/admin/mcp-connector/connections", handle(async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deleteMcpTokensForUser(req.session.userId);
    console.log(`[mcp] user ${req.session.userId} disconnected all Claude connections`);
    res.json({ ok: true });
  }));

  /* ---------------- MCP endpoint ---------------- */
  const unauthorized = (res: Response, detail?: string) =>
    res
      .status(401)
      .set(
        "WWW-Authenticate",
        `Bearer realm="Open Startup Platform", resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"` +
          (detail ? `, error="invalid_token", error_description="${detail}"` : ""),
      )
      .json({ error: "unauthorized", error_description: detail ?? "Sign in required" });

  app.options("/mcp", cors);
  app.post("/mcp", cors, mcpLimiter, handle(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return unauthorized(res);
    const token = await storage.findMcpToken(sha256(header.slice(7).trim()), "access");
    if (!token) return unauthorized(res, "Token is invalid or expired");
    if (!isAllowedConnectorUser({ email: token.userEmail, role: token.userRole, isActive: token.userActive })) {
      return unauthorized(res, "Account no longer has access");
    }

    const server = new Server(
      { name: "open-startup-platform", version: "1.0.0" },
      {
        capabilities: { tools: {} },
        instructions:
          "Access to the Open Startup Platform, a Pan-African startup accelerator: startups, founders and their " +
          "contact emails, KYS tracks (seed / pre_seed), stages, metrics, review status, who needs attention, and " +
          "mentorship sessions with their Zoom transcripts. Use list_startups to find a startup's id before " +
          "get_startup_profile. To recap a session: list_mentorship_sessions (needsRecap: true), " +
          "get_session_transcript, draft the recap, show it to the user, and only then save_session_recap. " +
          `This connection's only write abilities: ${SCOPE_REGISTRY.filter((sc) => sc.id !== "platform:read" && GRANTED_SCOPES.includes(sc.id)).map((sc) => sc.consent).join("; ") || "none (read-only)"}. ` +
          "Contract and document file contents are never available.",
      },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: AI_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
        annotations: t.readOnly
          ? { readOnlyHint: true, openWorldHint: false }
          : { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        // Audit trail: who looked up what, visible in the container logs.
        console.log(`[mcp] ${token.userEmail} called ${request.params.name}`);
        const result = await executeAiTool(request.params.name, request.params.arguments ?? {}, {
          userEmail: token.userEmail,
          scopes: token.scope.split(" "),
        });
        const failed = !!result && typeof result === "object" && "error" in result;
        return { isError: failed, content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
        console.error("[mcp] tool failed:", request.params.name, error);
        return { isError: true, content: [{ type: "text", text: `Lookup failed: ${error?.message ?? error}` }] };
      }
    });

    // Stateless: a fresh server + transport per request, plain JSON responses
    // (no long-lived SSE streams to keep open through the reverse proxy).
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }));
  app.all("/mcp", cors, (_req, res) => res.set("Allow", "POST").status(405).json({ error: "method_not_allowed" }));
}
