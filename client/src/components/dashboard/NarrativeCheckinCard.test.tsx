import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/toast", () => ({ showToast: vi.fn() }));

import { NarrativeCheckinCard } from "./NarrativeCheckinCard";

const NOW = new Date();
const Q = Math.ceil((NOW.getMonth() + 1) / 3);

function renderCard(updates: any[] = []) {
  api.mockImplementation(async (url: string, opts?: any) =>
    url === "/api/monthly-updates" && !opts ? { updates } : { id: "new" },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NarrativeCheckinCard />
    </QueryClientProvider>,
  );
}

describe("NarrativeCheckinCard (A10)", () => {
  beforeEach(() => api.mockReset());

  it("submits the three answers plus status and support ask", async () => {
    renderCard();
    fireEvent.change(await screen.findByLabelText("What did you achieve this quarter?"), { target: { value: "Shipped v2" } });
    fireEvent.change(screen.getByLabelText("What's blocking you?"), { target: { value: "Hiring" } });
    fireEvent.change(screen.getByLabelText("What's the focus next?"), { target: { value: "Sales" } });
    fireEvent.click(screen.getByText("At risk"));
    fireEvent.click(screen.getByText(`Submit Q${Q} check-in`));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/monthly-updates", expect.objectContaining({ method: "POST" })));
    const body = JSON.parse(api.mock.calls.find((c) => c[1]?.method === "POST")![1].body);
    expect(body).toMatchObject({ achieved: "Shipped v2", blocked: "Hiring", focusNext: "Sales", status: "at_risk" });
  });

  it("prefills from this quarter's existing check-in and offers Update instead", async () => {
    renderCard([
      { id: "u1", periodQuarter: Q, periodYear: NOW.getFullYear(), achieved: "Old text", blocked: "B", focusNext: "F", status: "on_track", supportNeeded: null },
    ]);
    expect(await screen.findByDisplayValue("Old text")).toBeTruthy();
    expect(screen.getByText(`Update Q${Q} check-in`)).toBeTruthy();
  });

  it("refuses to submit with the questions empty", async () => {
    renderCard();
    await screen.findByText(`Submit Q${Q} check-in`);
    fireEvent.click(screen.getByText(`Submit Q${Q} check-in`));
    await new Promise((r) => setTimeout(r, 20));
    expect(api.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(0);
  });
});
