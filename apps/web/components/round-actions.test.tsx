import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoundActions } from "./round-actions";

afterEach(cleanup);

describe("RoundActions", () => {
  it("offers the missed items first and hides that action after a perfect round", () => {
    const retry = vi.fn();
    const next = vi.fn();
    const change = vi.fn();
    const { rerender } = render(
      <RoundActions
        changeLabel="Změnit výběr"
        missedCount={3}
        onChangeSelection={change}
        onNextRound={next}
        onRetryMissed={retry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Znovu jen chybné (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Další kolo" }));
    fireEvent.click(screen.getByRole("button", { name: "Změnit výběr" }));
    expect([retry, next, change].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);

    rerender(
      <RoundActions
        changeLabel="Změnit výběr"
        missedCount={0}
        onChangeSelection={change}
        onNextRound={next}
        onRetryMissed={retry}
      />,
    );
    expect(screen.queryByRole("button", { name: /Znovu jen chybné/u })).toBeNull();
  });
});
