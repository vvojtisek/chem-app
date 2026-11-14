import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HowItWorks } from "./how-it-works";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function details(): HTMLDetailsElement {
  const summary = screen.getByText("Jak to funguje");
  const element = summary.closest("details");
  if (!element) throw new Error("No disclosure.");
  return element;
}

describe("HowItWorks", () => {
  it("opens on the first visit only", () => {
    render(<HowItWorks id="test">Návod</HowItWorks>);
    expect(details().open).toBe(true);

    cleanup();
    render(<HowItWorks id="test">Návod</HowItWorks>);
    expect(details().open).toBe(false);
    expect(screen.getByText("Návod")).toBeInTheDocument();
  });
});
