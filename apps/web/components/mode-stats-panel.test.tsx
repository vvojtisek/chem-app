import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ModeStatsPanel } from "./mode-stats-panel";

afterEach(cleanup);

describe("ModeStatsPanel", () => {
  it("shows a friendly empty state", () => {
    render(
      <ModeStatsPanel
        isLoading={false}
        stats={{ totalAttempts: 0, correctAttempts: 0, byMode: [] }}
      />,
    );
    expect(screen.getByText("Zatím nejsou synchronizované žádné pokusy.")).toBeInTheDocument();
  });

  it("names each mode and reports its accepted attempt counts", () => {
    render(
      <ModeStatsPanel
        isLoading={false}
        stats={{
          totalAttempts: 7,
          correctAttempts: 5,
          byMode: [
            { mode: "periodic-table", totalAttempts: 4, correctAttempts: 3 },
            { mode: "equation", totalAttempts: 3, correctAttempts: 2 },
          ],
        }}
      />,
    );
    const periodic = screen.getByRole("heading", { name: "Periodická tabulka" }).closest("li");
    if (!periodic) throw new Error("Periodická tabulka není v souhrnu režimů.");
    expect(within(periodic).getByText("4 pokusů · 3 správně")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chemické rovnice" })).toBeInTheDocument();
  });

  it("explains temporary API unavailability without hiding the local overview", () => {
    render(<ModeStatsPanel isLoading={false} stats={undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Místní přehled prvků zůstává k dispozici",
    );
  });
});
