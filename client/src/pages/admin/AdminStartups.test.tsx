import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.fn();
vi.mock("../../lib/utils", async (orig) => ({ ...(await orig<any>()), api: (...a: any[]) => api(...a) }));
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ user: { id: "a1", email: "admin@open-startup.org", role: "admin", emailVerified: true }, loading: false, logout: vi.fn() }),
}));
vi.mock("../../lib/viewMode", () => ({
  useEffectiveRole: () => "admin",
  useViewMode: () => ({ viewMode: "admin", setViewMode: vi.fn() }),
}));

import AdminStartups from "./AdminStartups";

const ROWS = [
  { id: "1", companyName: "Verdant", website: null, location: "Lagos", stage: null, logoUrl: null, deletionRequestedAt: null, ownerName: "Ada", ownerEmail: "ada@verdant.io", kysTrack: "seed" },
  { id: "2", companyName: "Acme", website: null, location: "Tunis", stage: null, logoUrl: null, deletionRequestedAt: null, ownerName: "Bilel", ownerEmail: "bilel@acme.io", kysTrack: "pre_seed" },
  { id: "3", companyName: "Zeta", website: null, location: "Cairo", stage: null, logoUrl: null, deletionRequestedAt: "2026-01-01", ownerName: "Chi", ownerEmail: "chi@zeta.io", kysTrack: "seed" },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminStartups />
    </QueryClientProvider>,
  );
}

function visibleCompanies() {
  const table = screen.getByRole("table");
  return within(table).queryAllByText(/^(Verdant|Acme|Zeta)$/).map((el) => el.textContent);
}

describe("AdminStartups list tools (A4)", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation(async (url: string) => (url === "/api/admin/startups" ? { startups: ROWS } : {}));
  });

  it("search filters by name, owner and location", async () => {
    renderPage();
    await waitFor(() => expect(visibleCompanies()).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("Search startups"), { target: { value: "tunis" } });
    expect(visibleCompanies()).toEqual(["Acme"]);
    fireEvent.change(screen.getByLabelText("Search startups"), { target: { value: "ada@" } });
    expect(visibleCompanies()).toEqual(["Verdant"]);
  });

  it("clicking a header sorts ascending, again descending, again resets", async () => {
    renderPage();
    await waitFor(() => expect(visibleCompanies()).toHaveLength(3));
    const header = screen.getByRole("button", { name: /^Startup$/i });
    fireEvent.click(header);
    expect(visibleCompanies()).toEqual(["Acme", "Verdant", "Zeta"]);
    fireEvent.click(header);
    expect(visibleCompanies()).toEqual(["Zeta", "Verdant", "Acme"]);
    fireEvent.click(header);
    expect(visibleCompanies()).toEqual(["Verdant", "Acme", "Zeta"]); // original order
  });

  it("CSV export downloads the filtered view", async () => {
    const clicks: string[] = [];
    const realCreate = URL.createObjectURL;
    let csv = "";
    URL.createObjectURL = ((blob: Blob) => {
      void blob.text().then((t) => (csv = t));
      return "blob:test";
    }) as any;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    try {
      renderPage();
      await waitFor(() => expect(visibleCompanies()).toHaveLength(3));
      fireEvent.change(screen.getByLabelText("Search startups"), { target: { value: "verdant" } });
      fireEvent.click(screen.getByRole("button", { name: /CSV/i }));
      expect(clicks[0]).toMatch(/^startups-\d{4}-\d{2}-\d{2}\.csv$/);
      await waitFor(() => expect(csv).toContain("Verdant"));
      expect(csv).toContain("ada@verdant.io");
      expect(csv).not.toContain("Acme");
    } finally {
      URL.createObjectURL = realCreate;
      vi.restoreAllMocks();
    }
  });
});
