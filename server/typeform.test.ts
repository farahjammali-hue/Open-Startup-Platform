// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import crypto from "crypto";
import type { AddressInfo } from "net";
import type { Server as HttpServer } from "http";

const fake = vi.hoisted(() => ({
  startups: new Map<string, any>(),
  users: new Map<string, any>(),
  profiles: new Map<string, any>(),
  events: [] as any[],
}));

vi.mock("./storage", () => ({
  storage: {
    getStartupById: async (id: string) => fake.startups.get(id),
    getUserById: async (id: string) => fake.users.get(id),
    getKysProfile: async (startupId: string) => [...fake.profiles.values()].find((p) => p.startupId === startupId),
    setKysTrack: async (id: string, track: string) => {
      const p = fake.profiles.get(id);
      if (p) p.track = track;
      return p;
    },
    submitKysProfile: async (startupId: string, data: any) => {
      const p = { id: "k-" + startupId, startupId, status: "pending", ...data };
      fake.profiles.set(p.id, p);
      return p;
    },
    addKysEvent: async (e: any) => fake.events.push(e),
  },
}));

import { registerTypeform, trackFromAnswers, verifyTypeformSignature } from "./typeform";

const SECRET = "test-secret";
const STARTUP = "11111111-2222-4333-8444-555555555555";
let server: HttpServer;
let base: string;

function sign(body: string, secret = SECRET) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("base64");
}

function payload(over: { hidden?: any; label?: string; formId?: string } = {}) {
  return {
    event_type: "form_response",
    form_response: {
      form_id: over.formId ?? "O7MQvYnR",
      token: "resp1",
      hidden: over.hidden ?? { startup_id: STARTUP, email: "Founder@Acme.io" },
      answers: [
        { type: "choice", choice: { label: over.label ?? "Seed Program - Track 1" }, field: { id: "f1", type: "multiple_choice" } },
        { type: "text", text: "Acme Ltd", field: { id: "f2", type: "short_text" } },
      ],
    },
  };
}

async function post(body: any, signature?: string) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${base}/api/typeform/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature !== undefined ? { "Typeform-Signature": signature } : {}) },
    body: raw,
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  process.env.TYPEFORM_WEBHOOK_SECRET = SECRET;
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
  registerTypeform(app);
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

beforeEach(() => {
  fake.startups.clear();
  fake.users.clear();
  fake.profiles.clear();
  fake.events.length = 0;
  fake.users.set("u1", { id: "u1", email: "founder@acme.io" });
  fake.startups.set(STARTUP, { id: STARTUP, userId: "u1", companyName: "Acme" });
});

describe("trackFromAnswers", () => {
  it("maps the program answer", () => {
    expect(trackFromAnswers([{ choice: { label: "Pre-Seed Program" } }])).toBe("pre_seed");
    expect(trackFromAnswers([{ choice: { label: "Seed Program - Track 1" } }])).toBe("seed");
    expect(trackFromAnswers([{ choice: { label: "Other" } }])).toBeNull();
    expect(trackFromAnswers([])).toBeNull();
  });
});

describe("verifyTypeformSignature", () => {
  it("accepts only the right secret", () => {
    expect(verifyTypeformSignature("{}", sign("{}"), SECRET)).toBe(true);
    expect(verifyTypeformSignature("{}", sign("{}", "other"), SECRET)).toBe(false);
    expect(verifyTypeformSignature("{}", undefined, SECRET)).toBe(false);
    expect(verifyTypeformSignature("{}", sign("{}"), "")).toBe(false);
  });
});

describe("POST /api/typeform/webhook", () => {
  it("rejects unsigned or wrongly signed requests without touching data", async () => {
    const body = payload();
    expect((await post(body)).status).toBe(401);
    expect((await post(body, sign("tampered"))).status).toBe(401);
    expect(fake.profiles.size).toBe(0);
  });

  it("sets the track on an already-recorded KYS submission", async () => {
    fake.profiles.set("k1", { id: "k1", startupId: STARTUP, track: null, status: "pending" });
    const body = payload();
    const res = await post(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(fake.profiles.get("k1").track).toBe("seed");
    expect(fake.events).toHaveLength(0);
  });

  it("records the submission itself if the founder's page didn't", async () => {
    const body = payload({ label: "Pre-Seed Program" });
    await post(body, sign(JSON.stringify(body)));
    const p = [...fake.profiles.values()][0];
    expect(p).toMatchObject({ startupId: STARTUP, track: "pre_seed", status: "pending" });
    expect(fake.events[0]).toMatchObject({ action: "submitted", startupId: STARTUP });
  });

  it("leaves the track empty for an Other answer", async () => {
    fake.profiles.set("k1", { id: "k1", startupId: STARTUP, track: null });
    const body = payload({ label: "Other" });
    await post(body, sign(JSON.stringify(body)));
    expect(fake.profiles.get("k1").track).toBeNull();
  });

  it("ignores a response whose email doesn't match the startup's owner", async () => {
    const body = payload({ hidden: { startup_id: STARTUP, email: "someone@else.com" } });
    const res = await post(body, sign(JSON.stringify(body)));
    expect(res.body.ignored).toBe("no matching startup");
    expect(fake.profiles.size).toBe(0);
  });

  it("ignores responses without hidden fields or from other forms", async () => {
    for (const body of [payload({ hidden: {} }), payload({ formId: "OTHER123" })]) {
      const res = await post(body, sign(JSON.stringify(body)));
      expect(res.status).toBe(200);
      expect(res.body.ignored).toBeTruthy();
    }
    expect(fake.profiles.size).toBe(0);
  });
});
