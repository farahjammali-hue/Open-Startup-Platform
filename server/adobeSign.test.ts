// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "fs";
import type { AddressInfo } from "net";
import type { Server as HttpServer } from "http";

const fake = vi.hoisted(() => ({
  users: new Map<string, any>(),
  startups: [] as any[],
  signed: [] as string[],
}));

vi.mock("./storage", () => ({
  storage: {
    getUserByEmail: async (email: string) => fake.users.get(email.toLowerCase()),
    getStartupsByUserId: async (userId: string) => fake.startups.filter((s) => s.userId === userId),
    resolveActiveStartup: async (user: any) => fake.startups.find((s) => s.userId === user.id),
    markDeclarationSigned: async (id: string) => fake.signed.push(id),
  },
}));

import { registerAdobeSign, declarationFilePath, participantEmails } from "./adobeSign";

const CLIENT_ID = "test-client-id";
const STARTUP_ID = "11111111-2222-4333-8444-555555555555";
let server: HttpServer;
let base: string;

function payload(over: { email?: string; doc?: string | null; event?: string } = {}) {
  return {
    event: over.event ?? "AGREEMENT_WORKFLOW_COMPLETED",
    agreement: {
      id: "agr1",
      status: "SIGNED",
      participantSetsInfo: { participantSets: [{ memberInfos: [{ email: over.email ?? "Founder@Acme.io" }] }] },
    },
    ...(over.doc === null ? {} : { signedDocumentInfo: { document: over.doc ?? Buffer.from("%PDF-1.4 test").toString("base64") } }),
  };
}

async function post(body: any, clientId?: string) {
  const res = await fetch(`${base}/api/adobe-sign/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(clientId !== undefined ? { "X-AdobeSign-ClientId": clientId } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID = CLIENT_ID;
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  registerAdobeSign(app);
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

beforeEach(() => {
  fake.users.clear();
  fake.startups.length = 0;
  fake.signed.length = 0;
  fake.users.set("founder@acme.io", { id: "u1", email: "founder@acme.io" });
  fake.startups.push({ id: STARTUP_ID, userId: "u1", companyName: "Acme" });
  fs.rmSync(declarationFilePath(STARTUP_ID), { force: true });
});

describe("participantEmails", () => {
  it("collects and lowercases every member email", () => {
    expect(participantEmails(payload().agreement)).toEqual(["founder@acme.io"]);
    expect(participantEmails({})).toEqual([]);
  });
});

describe("GET /api/adobe-sign/webhook (Adobe's registration check)", () => {
  it("echoes the client id back only for the right id", async () => {
    const ok = await fetch(`${base}/api/adobe-sign/webhook`, { headers: { "X-AdobeSign-ClientId": CLIENT_ID } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-adobesign-clientid")).toBe(CLIENT_ID);
    expect((await ok.json()).xAdobeSignClientId).toBe(CLIENT_ID);
    expect((await fetch(`${base}/api/adobe-sign/webhook`, { headers: { "X-AdobeSign-ClientId": "wrong" } })).status).toBe(401);
    expect((await fetch(`${base}/api/adobe-sign/webhook`)).status).toBe(401);
  });
});

describe("POST /api/adobe-sign/webhook", () => {
  it("refuses requests without Adobe's client id", async () => {
    expect((await post(payload())).status).toBe(401);
    expect((await post(payload(), "wrong")).status).toBe(401);
    expect(fake.signed).toEqual([]);
  });

  it("stores the signed PDF under the matched startup and records the signature", async () => {
    const res = await post(payload(), CLIENT_ID);
    expect(res.status).toBe(200);
    expect(fake.signed).toEqual([STARTUP_ID]);
    expect(fs.readFileSync(declarationFilePath(STARTUP_ID), "utf8")).toContain("%PDF");
  });

  it("matches the signer email case-insensitively and replaces the PDF on a redo", async () => {
    await post(payload({ doc: Buffer.from("%PDF-first").toString("base64") }), CLIENT_ID);
    await post(payload({ email: "FOUNDER@ACME.IO", doc: Buffer.from("%PDF-second").toString("base64") }), CLIENT_ID);
    expect(fs.readFileSync(declarationFilePath(STARTUP_ID), "utf8")).toContain("second");
    expect(fake.signed).toEqual([STARTUP_ID, STARTUP_ID]);
  });

  it("still records the signature when the PDF is missing from the payload", async () => {
    const res = await post(payload({ doc: null }), CLIENT_ID);
    expect(res.status).toBe(200);
    expect(fake.signed).toEqual([STARTUP_ID]);
    expect(fs.existsSync(declarationFilePath(STARTUP_ID))).toBe(false);
  });

  it("ignores signers who match no startup", async () => {
    const res = await post(payload({ email: "stranger@nowhere.io" }), CLIENT_ID);
    expect(res.body.ignored).toBe("no matching startup");
    expect(fake.signed).toEqual([]);
    expect(fs.existsSync(declarationFilePath(STARTUP_ID))).toBe(false);
  });

  it("ignores non-completion events", async () => {
    const res = await post({ event: "AGREEMENT_CREATED", agreement: { status: "OUT_FOR_SIGNATURE" } }, CLIENT_ID);
    expect(res.body.ignored).toBeTruthy();
    expect(fake.signed).toEqual([]);
  });
});
