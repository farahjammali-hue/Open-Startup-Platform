// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { postOps } from "./notify";

describe("postOps (C2)", () => {
  afterEach(() => {
    delete process.env.OPS_WEBHOOK_URL;
    vi.restoreAllMocks();
  });

  it("does nothing when OPS_WEBHOOK_URL is unset", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    postOps("hello");
    expect(spy).not.toHaveBeenCalled();
  });

  it("POSTs Slack-style JSON to the configured URL", async () => {
    process.env.OPS_WEBHOOK_URL = "https://hooks.example/T123";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    postOps("🆕 New application: Acme");
    expect(spy).toHaveBeenCalledWith("https://hooks.example/T123", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse((spy.mock.calls[0][1] as any).body)).toEqual({ text: "🆕 New application: Acme" });
  });

  it("never throws, even when the webhook is down", async () => {
    process.env.OPS_WEBHOOK_URL = "https://hooks.example/T123";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect(() => postOps("boom")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10)); // let the rejection settle through the catch
  });
});
