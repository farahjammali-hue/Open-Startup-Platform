import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/toast", () => ({ showToast: vi.fn() }));

import { GoalsPanel } from "./GoalsPanel";

const GOALS = [
  { id: "g1", title: "Close 3 pilots", description: null, targetDate: "2026-12-01T00:00:00Z", status: "on_track" },
  { id: "g2", title: "Hire a CTO", description: null, targetDate: null, status: "done" },
];

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GoalsPanel apiBase="/api/goals" />
    </QueryClientProvider>,
  );
}

describe("GoalsPanel (A9)", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation(async (url: string, opts?: any) =>
      url === "/api/goals" && !opts ? { goals: GOALS } : {},
    );
  });

  it("lists goals with their status", async () => {
    renderPanel();
    expect(await screen.findByText("Close 3 pilots")).toBeTruthy();
    expect((screen.getByLabelText("Status of Close 3 pilots") as HTMLSelectElement).value).toBe("on_track");
  });

  it("adds a goal through the API base", async () => {
    renderPanel();
    await screen.findByText("Close 3 pilots");
    fireEvent.click(screen.getByText("Add goal"));
    fireEvent.change(screen.getByPlaceholderText(/Close 3 pilot contracts/), { target: { value: "Raise the bridge" } });
    fireEvent.click(screen.getByText("Save goal"));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/goals", expect.objectContaining({ method: "POST" })),
    );
    const body = JSON.parse(api.mock.calls.find((c) => c[1]?.method === "POST")![1].body);
    expect(body.title).toBe("Raise the bridge");
  });

  it("changing status PATCHes the goal's own URL", async () => {
    renderPanel();
    await screen.findByText("Close 3 pilots");
    fireEvent.change(screen.getByLabelText("Status of Close 3 pilots"), { target: { value: "at_risk" } });
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/goals/g1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "at_risk" }) })),
    );
  });
});
