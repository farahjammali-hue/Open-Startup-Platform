import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "founder@example.com" } }) }));
vi.mock("../../lib/toast", () => ({ showToast: vi.fn() }));

import { KysStep } from "./KysStep";

function renderStep(onSubmitted = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <KysStep initial={null} onSubmitted={onSubmitted} />
    </QueryClientProvider>,
  );
  return onSubmitted;
}

describe("KysStep", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation(async (url: string) =>
      url === "/api/startups" ? { startups: [{ id: "s1", companyName: "Acme" }], activeStartupId: "s1" } : {},
    );
  });

  it("shows the embedded Typeform after a track is picked, without completing the step", async () => {
    const onSubmitted = renderStep();
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByText("Seed Track"));
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    const src = document.querySelector("iframe")!.getAttribute("src")!;
    expect(src).toContain("form.typeform.com/to/O7MQvYnR");
    expect(src).toContain("startup_id=s1");
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalledWith("/api/kys", expect.anything());
  });
});
