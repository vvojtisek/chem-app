import { curatedElements, type ElementFlashcardData } from "@inorganic/content/runtime";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appendAttempt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/browser-progress-store", () => ({
  createBrowserProgressStore: () => ({ appendAttempt }),
}));

vi.mock("@/components/use-periodic-session", () => ({
  usePeriodicSession: () => ({
    loading: false,
    storageBroken: false,
    notice: "",
    save: vi.fn(),
    discard: vi.fn(),
    recover: vi.fn(),
  }),
}));

import { ELEMENT_SELECTION_KEY } from "@/lib/periodic-table-preferences";
import { PeriodicTablePractice } from "./periodic-table-practice";
import { WRONG_MARK_DURATION_MS } from "./use-wrong-marks";

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

const keepOrder = () => 0.999_999;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  window.localStorage.clear();
  appendAttempt.mockReset();
  appendAttempt.mockResolvedValue(undefined);
});

function renderPractice(
  elements: readonly ElementFlashcardData[],
  random: () => number = keepOrder,
): void {
  render(<PeriodicTablePractice elements={elements} random={random} />);
  fireEvent.click(startButton());
}

function startButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Přejít na cvičení/ });
}

function table(): HTMLElement {
  return screen.getByRole("region", { name: "Periodická tabulka" });
}

function cell(name: string): HTMLElement {
  return within(table()).getByRole("button", { name });
}

function sought(): HTMLElement {
  return screen.getByRole("heading", { name: /^Hledaný prvek:/ });
}

describe("PeriodicTablePractice", () => {
  it("shows only the sought element, the live score, the stopwatch, and the table", () => {
    renderPractice([hydrogen, helium, lithium]);

    expect(sought()).toHaveAccessibleName("Hledaný prvek: Vodík");
    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.queryByText(/Kam patří|Vyberte|posuňte tabulku/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Pokračovat" })).toBeNull();
  });

  it("renders all reviewed elements as identical blind cells", () => {
    render(<PeriodicTablePractice elements={curatedElements} />);
    fireEvent.click(startButton());

    const cells = [...document.querySelectorAll<HTMLButtonElement>("[data-element-id]")];
    expect(cells).toHaveLength(118);
    expect(new Set(cells.map((candidate) => candidate.className)).size).toBe(1);
    expect(new Set(cells.map((candidate) => candidate.textContent)).size).toBe(1);
    expect(cells[0]).toHaveTextContent("?");
    expect(cells.every((candidate) => !candidate.disabled)).toBe(true);
    expect(within(table()).queryAllByRole("button", { name: /Vybraná pozice/ })).toHaveLength(0);
  });

  it("starts with the shared element selection and asks only the selected elements", () => {
    render(<PeriodicTablePractice elements={curatedElements} random={keepOrder} />);

    expect(startButton()).toHaveTextContent("Přejít na cvičení (90 prvků)");
    fireEvent.click(screen.getByRole("button", { name: "Zrušit výběr" }));
    fireEvent.click(within(table()).getByRole("button", { name: "Vodík (H)" }));
    expect(startButton()).toHaveTextContent("Přejít na cvičení (1 prvek)");
    expect(JSON.parse(window.localStorage.getItem(ELEMENT_SELECTION_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      elementIds: ["element.001-h"],
    });
    fireEvent.click(startButton());

    expect(sought()).toHaveAccessibleName("Hledaný prvek: Vodík");
    fireEvent.click(cell("Perioda 1, skupina 18"));
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    fireEvent.click(cell("Perioda 1, skupina 1"));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Umístěno").nextElementSibling).toHaveTextContent("1 z 1");
    fireEvent.click(within(summary).getByRole("button", { name: "Změnit výběr" }));
    expect(startButton()).toHaveTextContent("Přejít na cvičení (1 prvek)");
  });

  it("marks a correct click green with the symbol and moves straight to the next element", () => {
    renderPractice([hydrogen, helium, lithium]);

    fireEvent.click(cell("Perioda 1, skupina 1"));

    expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");
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

  it("marks a wrong click red for 10 seconds, ignores it meanwhile, and asks the element again later", () => {
    vi.useFakeTimers();
    expect(WRONG_MARK_DURATION_MS).toBe(10_000);
    renderPractice([hydrogen, helium, lithium]);

    fireEvent.click(cell("Perioda 2, skupina 1"));

    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(cell("Perioda 2, skupina 1: chybná odpověď")).toHaveTextContent("✗10");
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");
    expect(appendAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: hydrogen.id, round: "initial", isCorrect: false }),
    );

    fireEvent.click(cell("Perioda 2, skupina 1: chybná odpověď"));
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");

    act(() => vi.advanceTimersByTime(9_000));
    expect(cell("Perioda 2, skupina 1: chybná odpověď")).toHaveTextContent("✗1");
    act(() => vi.advanceTimersByTime(WRONG_MARK_DURATION_MS - 9_001));
    expect(cell("Perioda 2, skupina 1: chybná odpověď")).toHaveTextContent("✗");
    act(() => vi.advanceTimersByTime(1));
    expect(cell("Perioda 2, skupina 1")).toHaveTextContent("?");

    fireEvent.click(cell("Perioda 1, skupina 18"));
    fireEvent.click(cell("Perioda 2, skupina 1"));
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Vodík");

    fireEvent.click(cell("Perioda 1, skupina 1"));
    expect(appendAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: hydrogen.id, round: "retry", isCorrect: true }),
    );
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeInTheDocument();
  });

  it("lets the sought element be placed while its own cell still shows a red mark", () => {
    renderPractice([hydrogen, helium]);

    fireEvent.click(cell("Perioda 1, skupina 18"));
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");

    fireEvent.click(cell("Perioda 1, skupina 18: chybná odpověď"));

    expect(cell("Perioda 1, skupina 18: He, vyřešeno")).toHaveTextContent("He");
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
  });

  it("counts a double click once", () => {
    renderPractice([hydrogen, helium, lithium]);
    const lithiumCell = cell("Perioda 2, skupina 1");

    act(() => {
      fireEvent.click(lithiumCell);
      fireEvent.click(lithiumCell);
    });
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();

    fireEvent.click(cell("Perioda 1, skupina 18"));
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Lithium");
    act(() => {
      fireEvent.click(lithiumCell);
      fireEvent.click(lithiumCell);
    });
    expect(screen.getByText("Správně: 2")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
  });

  it("runs a stopwatch that Ukončit stops before showing the summary", () => {
    vi.useFakeTimers();
    renderPractice([hydrogen, helium, lithium]);

    act(() => vi.advanceTimersByTime(65_000));
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");

    fireEvent.click(cell("Perioda 1, skupina 1"));
    fireEvent.click(cell("Perioda 2, skupina 1"));
    fireEvent.click(screen.getByRole("button", { name: "Ukončit" }));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Čas").nextElementSibling).toHaveTextContent("01:05");
    expect(within(summary).getByText("Správně").nextElementSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Špatně").nextElementSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Umístěno").nextElementSibling).toHaveTextContent("1 z 3");
    expect(within(summary).getByText("Úspěšnost").nextElementSibling).toHaveTextContent("50 %");
    expect(screen.getByRole("button", { name: "Ukončit" })).toBeDisabled();
    expect(cell("Perioda 1, skupina 18")).toBeDisabled();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");
  });

  it("resets the table, the score, and the stopwatch and starts again", () => {
    vi.useFakeTimers();
    renderPractice([hydrogen, helium, lithium]);
    fireEvent.click(cell("Perioda 1, skupina 1"));
    fireEvent.click(cell("Perioda 2, skupina 1"));
    act(() => vi.advanceTimersByTime(12_000));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Začít znovu" }));

    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(cell("Perioda 1, skupina 1")).toHaveTextContent("?");
    expect(cell("Perioda 2, skupina 1")).toHaveTextContent("?");
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Vodík");
  });

  it("finishes automatically once every element is placed", () => {
    renderPractice([hydrogen]);

    fireEvent.click(cell("Perioda 1, skupina 1"));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Umístěno").nextElementSibling).toHaveTextContent("1 z 1");
    expect(within(summary).getByText("Úspěšnost").nextElementSibling).toHaveTextContent("100 %");
  });

  it("asks the elements in the injected random order", () => {
    renderPractice([hydrogen, helium, lithium], () => 0);

    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");
  });

  it("shows a local persistence failure without stopping the exercise", async () => {
    appendAttempt.mockRejectedValueOnce(new Error("Úložiště je uzamčeno."));
    renderPractice([hydrogen, helium]);

    fireEvent.click(cell("Perioda 1, skupina 1"));

    expect(
      await screen.findByText("Pokus se nepodařilo uložit: Úložiště je uzamčeno."),
    ).toBeInTheDocument();
    expect(sought()).toHaveAccessibleName("Hledaný prvek: Helium");
  });
});
