import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./Dropdown";

describe("Dropdown", () => {
  it("renders the trigger and keeps the panel closed by default", () => {
    render(
      <Dropdown trigger="Open menu">
        {() => <div>Panel content</div>}
      </Dropdown>
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("opens the panel when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown trigger="Open menu">
        {() => <div>Panel content</div>}
      </Dropdown>
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("toggles closed when the trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown trigger="Open menu">
        {() => <div>Panel content</div>}
      </Dropdown>
    );
    const button = screen.getByRole("button", { name: "Open menu" });
    await user.click(button);
    await user.click(button);
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the dropdown", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dropdown trigger="Open menu">
          {() => <div>Panel content</div>}
        </Dropdown>
        <button>Outside</button>
      </div>
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("passes a working close callback to its children", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    render(
      <Dropdown trigger="Open menu">
        {(close) => (
          <button onClick={() => { onItemClick(); close(); }}>Item</button>
        )}
      </Dropdown>
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "Item" }));
    expect(onItemClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Item" })).not.toBeInTheDocument();
  });
});
