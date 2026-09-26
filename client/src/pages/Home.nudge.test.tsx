// A5: the Home hero nudges founders who haven't saved this month's metrics.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "f@acme.io", role: "startup", emailVerified: true }, loading: false, logout: vi.fn() }),
}));
vi.mock("../lib/viewMode", () => ({
  useEffectiveRole: () => "startup",
  useViewMode: () => ({ viewMode: "startup", setViewMode: vi.fn() }),
}));

import Home from "./Home";

const CURRENT = new Date().toISOString().slice(0, 7);
const MONTH_NAME = new Date().toLocaleString(undefined, { month: "long" });

function mockApis(metricEntries: any[]) {
  api.mockImplementation(async (url: string) => {
    if (url === "/api/kys") return { profile: { id: "k1", status: "approved", track: "seed" }, documents: [] };
    if (url === "/api/contract") return { contract: { id: "c1", status: "approved" } };
    if (url === "/api/startup/me") return { id: "s1", companyName: "Acme" };
    if (url === "/api/metrics") return { entries: metricEntries, profile: null, achievements: [] };
    if (url === "/api/mentorship") return { sessions: [] };
    if (url === "/api/office-hours/bookings") return { bookings: [] };
    if (url === "/api/startups") return { startups: [{ id: "s1", companyName: "Acme" }], activeStartupId: "s1" };
    return {};
  });
}

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Home />
    </QueryClientProvider>,
  );
}

describe("Home monthly-update nudge (A5)", () => {
  beforeEach(() => api.mockReset());

  it("nudges when the current month has no saved metrics", async () => {
    mockApis([{ period: "2020-01", values: { rev_cumulative: 1 } }]);
    renderHome();
    expect(await screen.findByText(`Submit your ${MONTH_NAME} update`)).toBeTruthy();
  });

  it("stays quiet once this month has at least one value", async () => {
    mockApis([{ period: CURRENT, values: { rev_cumulative: 5 } }]);
    renderHome();
    expect(await screen.findByText(/all caught up/i)).toBeTruthy();
    expect(screen.queryByText(`Submit your ${MONTH_NAME} update`)).toBeNull();
  });

  it("an empty entry for this month still counts as missing", async () => {
    mockApis([{ period: CURRENT, values: {} }]);
    renderHome();
    expect(await screen.findByText(`Submit your ${MONTH_NAME} update`)).toBeTruthy();
  });
});
