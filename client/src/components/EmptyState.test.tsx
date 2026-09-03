import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title, description, and icon", () => {
    const { container } = render(
      <EmptyState icon={Users} title="No team members yet" description="Add your first member to get started." />
    );
    expect(screen.getByText("No team members yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first member to get started.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("omits the action button when no actionLabel/onAction is given", () => {
    render(<EmptyState icon={Users} title="No team members yet" description="..." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders and wires up the action button when both actionLabel and onAction are given", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState icon={Users} title="No team members yet" description="..." actionLabel="Add member" onAction={onAction} />
    );
    const button = screen.getByRole("button", { name: "Add member" });
    await user.click(button);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("does not render the action button if only actionLabel is given without onAction", () => {
    render(<EmptyState icon={Users} title="No team members yet" description="..." actionLabel="Add member" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
