import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { curatedBalancingReactionLessons } from "@inorganic/content/balancing-reactions";
import { BalancingReactionsLesson } from "./balancing-reactions-lesson";

afterEach(cleanup);

describe("BalancingReactionsLesson", () => {
  it("steps through the boric-acid explanation and exposes the atom ledger", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);

    expect(
      screen.getByRole("heading", { name: "Příprava kyseliny borité z boraxu" }),
    ).toBeVisible();
    expect(screen.getByText("Krok 1 z 4")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Kontrola atomů" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "B" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Další krok/ }));
    expect(screen.getByText("Krok 2 z 4")).toBeInTheDocument();
    expect(screen.getByText(/Aktuální krok: Doplníme sodík/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Krok 3 z 4")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Krok 2 z 4")).toBeInTheDocument();
  });

  it("switches to the ionic synproportionation lesson with charge and redox ledgers", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);

    fireEvent.click(screen.getByRole("button", { name: /4\.\s*Disproporcionační/ }));

    expect(screen.getByRole("heading", { name: "Vznik jodu synproporcionací" })).toBeVisible();
    expect(screen.getByText("Celkový iontový náboj")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Oxidační čísla" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "IO3^-" })).toBeInTheDocument();
  });
});
