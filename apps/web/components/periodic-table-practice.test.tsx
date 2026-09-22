import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { curatedElements, type ElementFlashcardData } from "@inorganic/content/runtime";

const appendAttempt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/browser-progress-store", () => ({
  createBrowserProgressStore: () => ({ appendAttempt }),
}));

import { PeriodicTablePractice } from "./periodic-table-practice";

const hydrogen: ElementFlashcardData = {
  id: "element.001-h",
  atomicNumber: 1,
  symbol: "H",
  nameCs: "Vodík",
  nameLat: "Hydrogenium",
  period: 1,
  group: 1,
  atomicWeight: 1.008,
  valenceConfiguration: "1s1",
};

const lithium: ElementFlashcardData = {
  id: "element.003-li",
  atomicNumber: 3,
  symbol: "Li",
  nameCs: "Lithium",
  nameLat: "Lithium",
  period: 2,
  group: 1,
  atomicWeight: 6.94,
  valenceConfiguration: "1s2 2s1",
};

afterEach(cleanup);

beforeEach(() => {
  appendAttempt.mockReset();
  appendAttempt.mockResolvedValue(undefined);
});

describe("PeriodicTablePractice", () => {
  it("renders all reviewed elements in their blind-table positions", () => {
    render(<PeriodicTablePractice elements={curatedElements} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));

    expect(document.querySelectorAll("[data-element-id]")).toHaveLength(118);
  });

  it("records a correct position answer with its learning context", async () => {
    render(<PeriodicTablePractice elements={[hydrogen]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    fireEvent.click(screen.getByRole("button", { name: "Perioda 1, skupina 1" }));

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    expect(screen.getByText(/Vodík patří na pozici/)).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: hydrogen.id,
          round: "initial",
          mode: "periodic-table",
          direction: "name-to-position",
          matchPolicy: "exact-position",
          isCorrect: true,
        }),
      );
    });
  });

  it("repeats an incorrect position once", async () => {
    render(<PeriodicTablePractice elements={[hydrogen, lithium]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    fireEvent.click(screen.getByRole("button", { name: "Perioda 2, skupina 1" }));
    expect(screen.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByRole("heading", { name: /Kam patří Lithium/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perioda 2, skupina 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Opakování chyby")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perioda 1, skupina 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));

    expect(screen.getByRole("heading", { name: "Cvičení dokončeno" })).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenLastCalledWith(
        expect.objectContaining({ round: "retry", isCorrect: true }),
      );
    });
  });

  it("accepts a Czech name for a highlighted position", async () => {
    render(<PeriodicTablePractice direction="position-to-name" elements={[hydrogen]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    expect(screen.getByRole("heading", { name: /Jak se jmenuje prvek/ })).toBeInTheDocument();
    expect(screen.getByText("Vybraná pozice: Perioda 1, skupina 1.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "vodik" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "periodic-table",
          direction: "position-to-name",
          matchPolicy: "diacritics-tolerant",
          isCorrect: true,
        }),
      );
    });
  });

  it("repeats an incorrectly named position once", async () => {
    render(<PeriodicTablePractice direction="position-to-name" elements={[hydrogen]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "Lithium" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));

    expect(screen.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeInTheDocument();
    expect(screen.getByText(/Perioda 1, skupina 1 je/)).toHaveTextContent(
      "Perioda 1, skupina 1 je Vodík.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Opakování chyby")).toBeInTheDocument();
    expect(screen.getByText("Vybraná pozice: Perioda 1, skupina 1.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "Vodík" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByRole("heading", { name: "Cvičení dokončeno" })).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenLastCalledWith(
        expect.objectContaining({
          direction: "position-to-name",
          round: "retry",
          isCorrect: true,
        }),
      );
    });
  });
});
