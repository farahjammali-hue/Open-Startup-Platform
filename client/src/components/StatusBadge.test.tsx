import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders its label text", () => {
    render(<StatusBadge tone="teal">Approved</StatusBadge>);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("applies the tone's classes", () => {
    render(<StatusBadge tone="amber">Pending</StatusBadge>);
    expect(screen.getByText("Pending").closest("span")).toHaveClass("bg-amber-bg", "text-amber-text");
  });

  it("renders an icon when provided", () => {
    const { container } = render(
      <StatusBadge tone="teal" icon={CheckCircle2}>Done</StatusBadge>
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("omits the icon when none is provided", () => {
    const { container } = render(<StatusBadge tone="gray">Locked</StatusBadge>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
