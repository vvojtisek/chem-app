import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeDashboard } from "./practice-dashboard";

afterEach(cleanup);

function renderDashboard(overrides: Partial<Parameters<typeof PracticeDashboard>[0]> = {}) {
  const props = {
    correct: 3,
    incorrect: 1,
    elapsedMs: 65_000,
    running: true,
    onReset: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<PracticeDashboard {...props} />);
  return props;
}

describe("PracticeDashboard", () => {
  it("shows the counts, the stopwatch and the position in the set", () => {
    renderDashboard({ progress: { done: 12, total: 101 } });

    expect(screen.getByText("Správně: 3")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");
    const progress = screen.getByRole("progressbar", { name: "Postup cvičením" });
    expect(progress).toHaveAttribute("aria-valuenow", "12");
    expect(progress).toHaveAttribute("aria-valuemax", "101");
    expect(progress).toHaveAttribute("aria-valuetext", "12 z 101");
  });

  it("omits the position when the exercise has no fixed set", () => {
    renderDashboard();

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("resets only after confirmation", () => {
    const props = renderDashboard();
    const reset = screen.getByRole("button", { name: "Reset" });

    fireEvent.click(reset);
    expect(reset).toHaveAttribute("aria-expanded", "true");
    expect(props.onReset).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("group", { name: "Potvrzení resetu" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Začít znovu" }));

    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: "Potvrzení resetu" })).toBeNull();
  });

  it("keeps the exercise when the reset is cancelled", () => {
    const props = renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));

    expect(props.onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Potvrzení resetu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
  });

  it("finishes on Ukončit only while the exercise runs", () => {
    const props = renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Ukončit" }));
    expect(props.onFinish).toHaveBeenCalledTimes(1);

    cleanup();
    renderDashboard({ running: false });
    expect(screen.getByRole("button", { name: "Ukončit" })).toBeDisabled();
  });
});
