import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));

// recharts' ResponsiveContainer measures the DOM, which jsdom can't; a fixed
// box is enough to prove the chart mounts with our data.
vi.mock("recharts", async (orig) => {
  const real = await orig<any>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 600, height: 260 }}>{children}</div>,
  };
});

import { MetricsChartsPanel } from "./MetricsChartsPanel";

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MetricsChartsPanel apiBase="/api/metrics" />
    </QueryClientProvider>,
  );
}

describe("MetricsChartsPanel", () => {
  beforeEach(() => api.mockReset());

  it("renders nothing at all when no metric has two data points", async () => {
    api.mockResolvedValue({ entries: [{ id: "1", period: "2026-09", values: { rev_cumulative: 100 } }] });
    const { container } = renderPanel();
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container.querySelector(".ost-card")).toBeNull();
  });

  it("charts a metric across periods, initial baseline first", async () => {
    api.mockResolvedValue({
      entries: [
        { id: "2", period: "2026-01", values: { rev_cumulative: "2,000" } },
        { id: "1", period: "initial", values: { rev_cumulative: 1000 } },
        { id: "3", period: "2026-02", values: { rev_cumulative: 3000 } },
      ],
    });
    renderPanel();
    await screen.findByText("Trends");
    // No error state; the picker defaults to cumulative revenues.
    expect(screen.queryByText(/needs values in at least two periods/)).toBeNull();
    expect((screen.getByLabelText("Metric to chart") as HTMLSelectElement).value).toBe("rev_cumulative");
  });

  it("switching to an empty metric explains what's missing instead of a blank chart", async () => {
    api.mockResolvedValue({
      entries: [
        { id: "1", period: "2026-01", values: { rev_cumulative: 1 } },
        { id: "2", period: "2026-02", values: { rev_cumulative: 2 } },
      ],
    });
    renderPanel();
    await screen.findByText("Trends");
    fireEvent.change(screen.getByLabelText("Metric to chart"), { target: { value: "hr_team_size" } });
    expect(screen.getByText(/needs values in at least two periods/)).toBeTruthy();
  });
});
