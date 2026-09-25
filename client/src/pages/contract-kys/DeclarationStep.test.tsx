import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/toast", () => ({ showToast: vi.fn() }));

import { DeclarationStep } from "./DeclarationStep";

function post(origin: string, data: unknown) {
  window.dispatchEvent(new MessageEvent("message", { origin, data }));
}

describe("DeclarationStep", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockResolvedValue({ ok: true });
  });

  it("embeds the Acrobat Sign form", () => {
    render(<DeclarationStep onSigned={vi.fn()} />);
    expect(document.querySelector("iframe")!.getAttribute("src")).toContain("documents.adobe.com/public/esignWidget");
  });

  it("completes when Adobe reports the signature", async () => {
    const onSigned = vi.fn();
    render(<DeclarationStep onSigned={onSigned} />);
    post("https://open-startup.na4.documents.adobe.com", JSON.stringify({ type: "ESIGN" }));
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledWith("/api/declaration/signed", { method: "POST" });
  });

  it("ignores other Adobe events and messages from other sites", async () => {
    const onSigned = vi.fn();
    render(<DeclarationStep onSigned={onSigned} />);
    post("https://open-startup.na4.documents.adobe.com", JSON.stringify({ type: "PAGE_LOAD" }));
    post("https://evil.example.com", JSON.stringify({ type: "ESIGN" }));
    post("https://adobe.com.evil.example", { type: "ESIGN" });
    await new Promise((r) => setTimeout(r, 20));
    expect(onSigned).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("has a manual fallback if Adobe's event never arrives", async () => {
    const onSigned = vi.fn();
    render(<DeclarationStep onSigned={onSigned} />);
    fireEvent.click(screen.getByText("Continue to the KYS form"));
    await waitFor(() => expect(onSigned).toHaveBeenCalled());
  });
});
