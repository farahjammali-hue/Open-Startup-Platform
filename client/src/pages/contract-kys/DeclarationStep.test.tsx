import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/toast", () => ({ showToast: vi.fn() }));

import { DeclarationStep } from "./DeclarationStep";

function renderStep(props: Partial<{ signed: boolean; onSigned: () => void; onContinue: () => void }> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DeclarationStep signed={props.signed ?? false} onSigned={props.onSigned ?? vi.fn()} onContinue={props.onContinue ?? vi.fn()} />
    </QueryClientProvider>,
  );
}

function post(origin: string, data: unknown) {
  window.dispatchEvent(new MessageEvent("message", { origin, data }));
}

describe("DeclarationStep (unsigned)", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation(async (url: string) =>
      url === "/api/declaration/status" ? { signedAt: null, hasFile: false } : { ok: true },
    );
  });

  it("embeds the Acrobat Sign form", () => {
    renderStep();
    expect(document.querySelector("iframe")!.getAttribute("src")).toContain("documents.adobe.com/public/esignWidget");
  });

  it("completes when Adobe reports the signature", async () => {
    const onSigned = vi.fn();
    renderStep({ onSigned });
    post("https://open-startup.na4.documents.adobe.com", JSON.stringify({ type: "ESIGN" }));
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledWith("/api/declaration/signed", { method: "POST" });
  });

  it("ignores other Adobe events and messages from other sites", async () => {
    const onSigned = vi.fn();
    renderStep({ onSigned });
    post("https://open-startup.na4.documents.adobe.com", JSON.stringify({ type: "PAGE_LOAD" }));
    post("https://evil.example.com", JSON.stringify({ type: "ESIGN" }));
    post("https://adobe.com.evil.example", { type: "ESIGN" });
    await new Promise((r) => setTimeout(r, 20));
    expect(onSigned).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalledWith("/api/declaration/signed", expect.anything());
  });

  it("has a manual fallback if Adobe's event never arrives", async () => {
    const onSigned = vi.fn();
    renderStep({ onSigned });
    fireEvent.click(screen.getByText("Continue to the KYS form"));
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
  });
});

describe("DeclarationStep (already signed)", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation(async (url: string) =>
      url === "/api/declaration/status" ? { signedAt: "2026-09-25T10:00:00Z", hasFile: true } : { ok: true },
    );
  });

  it("shows preview/download of the stored PDF instead of the signing form", async () => {
    renderStep({ signed: true });
    await waitFor(() => expect(screen.getByText("Preview")).toBeTruthy());
    expect(screen.getByText("Download")).toBeTruthy();
    expect(document.querySelector('iframe[src*="esignWidget"]')).toBeNull();
    expect(document.querySelector('iframe[src="/api/declaration/file"]')).not.toBeNull();
  });

  it("redo shows the signing form again, with a way back", async () => {
    renderStep({ signed: true });
    fireEvent.click(await screen.findByText("Redo the declaration"));
    expect(document.querySelector('iframe[src*="esignWidget"]')).not.toBeNull();
    fireEvent.click(screen.getByText("Keep the existing one"));
    await waitFor(() => expect(document.querySelector('iframe[src*="esignWidget"]')).toBeNull());
  });

  it("Continue moves on without re-signing", async () => {
    const onContinue = vi.fn();
    renderStep({ signed: true, onContinue });
    fireEvent.click(await screen.findByText("Continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalledWith("/api/declaration/signed", expect.anything());
  });
});
