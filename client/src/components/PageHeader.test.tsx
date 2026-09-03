import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackLink, PageHeader, TabBar } from "./PageHeader";

describe("BackLink", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/somewhere");
  });

  it("renders the default label", () => {
    render(<BackLink />);
    expect(screen.getByRole("button", { name: /back to home/i })).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<BackLink label="Back to Admin Dashboard" />);
    expect(screen.getByRole("button", { name: "Back to Admin Dashboard" })).toBeInTheDocument();
  });

  it("navigates to the given path by default", async () => {
    const user = userEvent.setup();
    render(<BackLink to="/admin" />);
    await user.click(screen.getByRole("button"));
    expect(window.location.pathname).toBe("/admin");
  });

  it("calls a custom onClick instead of navigating when provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BackLink onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("PageHeader", () => {
  it("renders eyebrow, title, and subtitle", () => {
    render(<PageHeader eyebrow="Program tools" title="KPI visualizations" subtitle="Charts built from your data." />);
    expect(screen.getByText("Program tools")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "KPI visualizations" })).toBeInTheDocument();
    expect(screen.getByText("Charts built from your data.")).toBeInTheDocument();
  });

  it("omits the subtitle paragraph when none is given", () => {
    const { container } = render(<PageHeader eyebrow="Settings" title="Account settings" />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders an optional action alongside the title", () => {
    render(<PageHeader eyebrow="Program tools" title="Mentorship" action={<button>Log session</button>} />);
    expect(screen.getByRole("button", { name: "Log session" })).toBeInTheDocument();
  });
});

describe("TabBar", () => {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "deepdive", label: "Deep dive" },
  ] as const;

  it("renders every tab", () => {
    render(<TabBar tabs={tabs} active="overview" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deep dive" })).toBeInTheDocument();
  });

  it("marks the active tab distinctly from inactive ones", () => {
    render(<TabBar tabs={tabs} active="overview" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Overview" })).toHaveClass("text-secondary-300");
    expect(screen.getByRole("button", { name: "Deep dive" })).not.toHaveClass("text-secondary-300");
  });

  it("calls onChange with the clicked tab's key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="overview" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Deep dive" }));
    expect(onChange).toHaveBeenCalledWith("deepdive");
  });
});
