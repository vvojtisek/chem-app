import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementFlashcardData } from "@inorganic/content/runtime";

const appendAttempt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/browser-progress-store", () => ({
  createBrowserProgressStore: () => ({ appendAttempt }),
}));

import { PeriodicTableNamePractice } from "./periodic-table-name-practice";

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

const helium: ElementFlashcardData = {
  id: "element.002-he",
  atomicNumber: 2,
  symbol: "He",
  nameCs: "Helium",
  nameLat: "Helium",
  period: 1,
  group: 18,
  atomicWeight: 4.0026,
  valenceConfiguration: "1s2",
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

function start(elements: readonly ElementFlashcardData[]): void {
  render(<PeriodicTableNamePractice elements={elements} />);
  fireEvent.click(screen.getByRole("button", { name: "Začít cvičení (10 pozic)" }));
}

function answer(text: string): void {
  fireEvent.change(screen.getByLabelText("Český název"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
}

function nextElement(): void {
  fireEvent.click(screen.getByRole("button", { name: "Další prvek" }));
}

function cell(name: string): HTMLElement {
  return within(screen.getByRole("region", { name: "Periodická tabulka" })).getByRole("button", {
    name,
  });
}

describe("PeriodicTableNamePractice", () => {
  it("keeps the table on screen and marks a correct answer with the element symbol", async () => {
    start([hydrogen, helium]);
    const table = screen.getByRole("region", { name: "Periodická tabulka" });

    expect(screen.getByLabelText("Český název")).toHaveFocus();
    expect(cell("Vybraná pozice: Perioda 1, skupina 1")).toHaveTextContent("●");

    answer("vodik");

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    expect(screen.getByText(/Perioda 1, skupina 1 je/)).toHaveTextContent(
      "Perioda 1, skupina 1 je Vodík (H).",
    );
    expect(screen.getByText(/doplňte českou diakritiku/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Periodická tabulka" })).toBe(table);
    expect(cell("Vybraná pozice: Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(screen.getByRole("button", { name: "Další prvek" })).toHaveFocus();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: hydrogen.id,
          round: "initial",
          mode: "periodic-table",
          direction: "position-to-name",
          matchPolicy: "diacritics-tolerant",
          isCorrect: true,
        }),
      );
    });

    nextElement();

    expect(screen.getByRole("region", { name: "Periodická tabulka" })).toBe(table);
    expect(screen.getByLabelText("Český název")).toHaveValue("");
    expect(screen.getByLabelText("Český název")).toHaveFocus();
    expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(cell("Vybraná pozice: Perioda 1, skupina 18")).toHaveTextContent("●");
  });

  it("keeps solved symbols through later questions and the summary without marking errors solved", () => {
    start([hydrogen, helium, lithium]);

    answer("Vodík");
    nextElement();
    answer("Helium");
    nextElement();

    expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(cell("Perioda 1, skupina 18: He, vyřešeno")).toHaveTextContent("He");

    answer("Sodík");
    expect(screen.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeInTheDocument();
    expect(screen.getByText(/Perioda 2, skupina 1 je/)).toHaveTextContent(
      "Perioda 2, skupina 1 je Lithium (Li).",
    );
    expect(cell("Vybraná pozice: Perioda 2, skupina 1: chybná odpověď")).toHaveTextContent("✗");

    nextElement();
    const table = screen.getByRole("region", { name: "Periodická tabulka" });
    expect(screen.getByText("Opakování chyby")).toBeInTheDocument();
    expect(cell("Vybraná pozice: Perioda 2, skupina 1")).toHaveTextContent("●");
    expect(within(table).queryByText("Li")).toBeNull();
    expect(screen.getByLabelText("Český název")).toHaveValue("");
    expect(screen.getByLabelText("Český název")).toHaveFocus();

    answer("Sodík");
    expect(screen.getByRole("heading", { name: "Chybně" })).toBeInTheDocument();
    nextElement();

    expect(screen.getByRole("heading", { name: "Cvičení dokončeno" })).toBeInTheDocument();
    expect(
      screen.getByText(/První průchod: 2 správně, 1 chybně\. Opakování: 0 správně, 1 chybně\./),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Český název")).toBeNull();
    expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(cell("Perioda 1, skupina 18: He, vyřešeno")).toHaveTextContent("He");
    expect(cell("Perioda 2, skupina 1: chybná odpověď")).toHaveTextContent("✗");
    expect(screen.getByRole("button", { name: "Začít znovu" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Začít znovu" }));
    expect(cell("Vybraná pozice: Perioda 1, skupina 1")).toHaveTextContent("●");
    expect(cell("Perioda 1, skupina 18")).toHaveTextContent("?");
  });

  it("does not count an empty answer as an attempt", () => {
    start([hydrogen]);

    answer("   ");

    expect(screen.getByText("Napište český název prvku.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeNull();
    expect(screen.getByLabelText("Český název")).toHaveFocus();
    expect(appendAttempt).not.toHaveBeenCalled();
  });

  it("evaluates and records a question once when it is submitted twice before re-rendering", async () => {
    start([hydrogen, helium]);
    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "Vodík" } });
    const form = screen.getByRole("button", { name: "Vyhodnotit" }).closest("form");
    if (!form) throw new Error("Answer form is missing.");

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenCalledOnce();
    });
  });

  it("ignores a held Enter key without blocking normal typing", () => {
    start([hydrogen, helium]);
    const input = screen.getByLabelText("Český název");

    expect(fireEvent.keyDown(input, { key: "Enter", repeat: true })).toBe(false);
    expect(fireEvent.keyDown(input, { key: "Backspace", repeat: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);

    answer("Vodík");
    const next = screen.getByRole("button", { name: "Další prvek" });

    expect(fireEvent.keyDown(next, { key: "Enter", repeat: true })).toBe(false);
    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
  });

  it("shows a local storage failure without blocking the result or the next question", async () => {
    appendAttempt.mockRejectedValueOnce(new Error("Úložiště je uzamčeno."));
    start([hydrogen, helium]);

    answer("Vodík");

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    expect(
      await screen.findByText("Pokus se nepodařilo uložit: Úložiště je uzamčeno."),
    ).toBeInTheDocument();

    nextElement();
    expect(screen.getByLabelText("Český název")).toBeEnabled();
    expect(screen.getByLabelText("Český název")).toHaveFocus();
  });
});
