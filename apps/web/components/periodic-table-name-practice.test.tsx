import { curatedElements, type ElementFlashcardData } from "@inorganic/content/runtime";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { ELEMENT_SELECTION_KEY, NAME_PRACTICE_MODE_KEY } from "@/lib/periodic-table-preferences";
import { INPUT_FLASH_DURATION_MS, PeriodicTableNamePractice } from "./periodic-table-name-practice";
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

const lanthanum: ElementFlashcardData = {
  id: "element.057-la",
  atomicNumber: 57,
  symbol: "La",
  nameCs: "Lanthan",
  nameLat: "Lanthanum",
  period: 6,
  group: null,
  atomicWeight: 138.91,
  valenceConfiguration: "5d1 6s2",
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
  elements: readonly ElementFlashcardData[] = [hydrogen, helium, lithium],
  random: () => number = keepOrder,
): void {
  render(<PeriodicTableNamePractice elements={elements} random={random} />);
}

function table(): HTMLElement {
  return screen.getByRole("region", { name: "Periodická tabulka" });
}

function cell(name: string): HTMLElement {
  return within(table()).getByRole("button", { name });
}

function startButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Přejít na cvičení/ });
}

function prompt(): HTMLElement {
  return screen.getByRole("heading", { name: /^Zadání:/ });
}

function answer(value: string): void {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  const form = input.closest("form");
  if (!form) throw new Error("The answer input is not inside a form.");
  fireEvent.submit(form);
}

function storedSelection(): unknown {
  return JSON.parse(window.localStorage.getItem(ELEMENT_SELECTION_KEY) ?? "null");
}

describe("PeriodicTableNamePractice selection", () => {
  it("shows the full table with all groups selected and the bottom rows left out by default", () => {
    render(<PeriodicTableNamePractice elements={curatedElements} />);

    expect(within(table()).getAllByRole("button", { pressed: true })).toHaveLength(90 + 18);
    expect(cell("Vodík (H)")).toHaveAttribute("aria-pressed", "true");
    expect(cell("Lanthan (La)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("Lutecium (Lu)")).toHaveAttribute("aria-pressed", "true");
    expect(cell("Lanthanidy (La–Yb)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("Aktinidy (Ac–No)")).toHaveAttribute("aria-pressed", "false");
    expect(startButton()).toHaveTextContent("Přejít na cvičení (90 prvků)");
    expect(screen.queryByText(/Série bude mít|Otázky se vyberou/)).toBeNull();
  });

  it("toggles a whole group column from its header and reports a partial column as mixed", () => {
    renderPractice();

    expect(cell("Skupina 1")).toHaveClass("bg-emerald-100");
    fireEvent.click(cell("Skupina 1"));
    expect(cell("Skupina 1")).toHaveClass("bg-rose-100", "line-through");
    expect(cell("Vodík (H)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("Lithium (Li)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("Skupina 1")).toHaveAttribute("aria-pressed", "false");
    expect(startButton()).toHaveTextContent("Přejít na cvičení (1 prvek)");

    fireEvent.click(cell("Lithium (Li)"));
    expect(cell("Skupina 1")).toHaveAttribute("aria-pressed", "mixed");
    expect(cell("Skupina 1")).toHaveClass("bg-amber-50");
    expect(startButton()).toHaveTextContent("Přejít na cvičení (2 prvky)");

    fireEvent.click(cell("Skupina 1"));
    expect(cell("Vodík (H)")).toHaveAttribute("aria-pressed", "true");
    expect(cell("Skupina 1")).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the lanthanide row as a whole", () => {
    renderPractice([hydrogen, lanthanum]);

    expect(cell("Lanthanidy (La–La)")).toHaveClass("bg-rose-100");
    fireEvent.click(cell("Lanthanidy (La–La)"));
    expect(cell("Lanthanidy (La–La)")).toHaveClass("bg-emerald-100");
    expect(cell("Lanthan (La)")).toHaveAttribute("aria-pressed", "true");
    expect(startButton()).toHaveTextContent("Přejít na cvičení (2 prvky)");

    fireEvent.click(cell("Lanthanidy (La–La)"));
    expect(cell("Lanthan (La)")).toHaveAttribute("aria-pressed", "false");
  });

  it("disables the exercise for an empty selection and explains why", () => {
    renderPractice();

    fireEvent.click(screen.getByRole("button", { name: "Zrušit výběr" }));

    expect(startButton()).toBeDisabled();
    expect(startButton()).toHaveTextContent("Přejít na cvičení (0 prvků)");
    expect(screen.getByText("Vyberte alespoň jeden prvek.")).toBeInTheDocument();
  });

  it("stores the selection and restores it on return", () => {
    renderPractice();
    fireEvent.click(cell("Helium (He)"));

    expect(storedSelection()).toEqual({
      schemaVersion: 1,
      elementIds: [hydrogen.id, lithium.id],
    });

    cleanup();
    renderPractice();

    expect(cell("Helium (He)")).toHaveAttribute("aria-pressed", "false");
    expect(cell("Vodík (H)")).toHaveAttribute("aria-pressed", "true");
    expect(startButton()).toHaveTextContent("Přejít na cvičení (2 prvky)");
  });

  it("uses the selection shared with the blind table", () => {
    window.localStorage.setItem(
      ELEMENT_SELECTION_KEY,
      JSON.stringify({ schemaVersion: 1, elementIds: [lithium.id] }),
    );

    renderPractice();

    expect(startButton()).toHaveTextContent("Přejít na cvičení (1 prvek)");
    fireEvent.click(startButton());
    expect(prompt()).toHaveAccessibleName("Zadání: Lithium");
  });

  it("falls back to the default selection when the stored preference is corrupt", () => {
    window.localStorage.setItem(ELEMENT_SELECTION_KEY, "{broken");

    renderPractice([hydrogen, lanthanum]);

    expect(startButton()).toHaveTextContent("Přejít na cvičení (1 prvek)");
  });
});

describe("PeriodicTableNamePractice exercise", () => {
  it("starts with a focused input, the dashboard, the Název → Značka mode, and a blind table", () => {
    renderPractice();
    fireEvent.click(startButton());

    expect(prompt()).toHaveAccessibleName("Zadání: Vodík");
    expect(screen.getByRole("textbox", { name: "Značka prvku" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Název → Značka" })).toBeChecked();
    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(cell("Perioda 1, skupina 1")).toHaveTextContent("?");
    expect(cell("Perioda 1, skupina 1").className).toBe(cell("Perioda 1, skupina 18").className);
    expect(within(table()).queryAllByRole("button", { name: /Vybraná pozice/ })).toHaveLength(0);
  });

  it("fills a correct symbol green, clears and refocuses the input, and moves on", () => {
    renderPractice();
    fireEvent.click(startButton());

    answer(" H ");

    expect(cell("Perioda 1, skupina 1: H, vyřešeno")).toHaveTextContent("H");
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByText("Správně: Vodík (H).")).toBeInTheDocument();
    expect(appendAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: hydrogen.id,
        round: "initial",
        mode: "periodic-table",
        direction: "name-to-symbol",
        matchPolicy: "symbol-exact",
        isCorrect: true,
      }),
    );
  });

  it("flashes a wrong answer, keeps the ✗ for 10 seconds, moves on at once, and asks again later", () => {
    vi.useFakeTimers();
    renderPractice();
    fireEvent.click(startButton());

    answer("h");

    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
    expect(screen.getByRole("textbox")).toHaveAttribute("data-flash", "incorrect");
    expect(cell("Perioda 1, skupina 1: chybná odpověď")).toHaveTextContent("✗");
    expect(
      screen.getByText("Špatně: Vodík (H). Značka musí mít přesnou velikost písmen."),
    ).toBeInTheDocument();
    expect(appendAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: hydrogen.id, round: "initial", isCorrect: false }),
    );

    act(() => vi.advanceTimersByTime(INPUT_FLASH_DURATION_MS));
    expect(screen.getByRole("textbox")).not.toHaveAttribute("data-flash");
    expect(cell("Perioda 1, skupina 1: chybná odpověď")).toHaveTextContent("✗");
    act(() => vi.advanceTimersByTime(WRONG_MARK_DURATION_MS - INPUT_FLASH_DURATION_MS - 1));
    expect(cell("Perioda 1, skupina 1: chybná odpověď")).toHaveTextContent("✗");
    act(() => vi.advanceTimersByTime(1));
    expect(cell("Perioda 1, skupina 1")).toHaveTextContent("?");

    answer("He");
    answer("Li");
    expect(prompt()).toHaveAccessibleName("Zadání: Vodík");
    answer("H");

    expect(appendAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: hydrogen.id, round: "retry", isCorrect: true }),
    );
    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Určeno").nextElementSibling).toHaveTextContent("3 z 3");
    expect(within(summary).getByText("Úspěšnost").nextElementSibling).toHaveTextContent("75 %");
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toHaveFocus();
  });

  it("asks for the Czech name in the Značka → Název mode and remembers the mode", () => {
    renderPractice();
    fireEvent.click(startButton());

    fireEvent.click(screen.getByRole("radio", { name: "Značka → Název" }));
    expect(prompt()).toHaveAccessibleName("Zadání: H");
    expect(JSON.parse(window.localStorage.getItem(NAME_PRACTICE_MODE_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      mode: "symbol-to-name",
    });

    answer("H");
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    answer("helium");
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    answer("Lithium");
    expect(appendAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        questionId: lithium.id,
        direction: "symbol-to-name",
        matchPolicy: "diacritics-tolerant",
        isCorrect: true,
      }),
    );

    cleanup();
    renderPractice();
    fireEvent.click(startButton());
    expect(screen.getByRole("radio", { name: "Značka → Název" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Český název prvku" })).toBeInTheDocument();
  });

  it("accepts a name without diacritics with a hint", () => {
    renderPractice();
    fireEvent.click(startButton());
    fireEvent.click(screen.getByRole("radio", { name: "Značka → Název" }));

    answer("vodik");

    expect(screen.getByText("Správně: Vodík (H). Příště doplňte diakritiku.")).toBeInTheDocument();
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
  });

  it("returns focus to the input after an answer sent with the Odeslat button", () => {
    renderPractice();
    fireEvent.click(startButton());
    const send = screen.getByRole("button", { name: "Odeslat" });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "H" } });
    send.focus();
    fireEvent.click(send);

    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("does not count an empty answer", () => {
    renderPractice();
    fireEvent.click(startButton());

    answer("   ");

    expect(screen.getByText("Napište značku prvku.")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: Vodík");
    expect(appendAttempt).not.toHaveBeenCalled();
  });

  it("evaluates a double submission once", () => {
    renderPractice();
    fireEvent.click(startButton());
    const input = screen.getByRole("textbox");
    const form = input.closest("form");
    if (!form) throw new Error("The answer input is not inside a form.");

    fireEvent.change(input, { target: { value: "H" } });
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(appendAttempt).toHaveBeenCalledTimes(1);
  });

  it("asks only the selected elements and keeps the rest of the table identically blind", () => {
    renderPractice([hydrogen, helium, lithium, lanthanum]);
    fireEvent.click(cell("Skupina 1"));
    fireEvent.click(startButton());

    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
    const blindCells = [
      "Perioda 1, skupina 1",
      "Perioda 1, skupina 18",
      "Lanthanidy, pozice 1",
    ].map(cell);
    for (const blind of blindCells) expect(blind).toHaveTextContent("?");
    expect(new Set(blindCells.map((blind) => blind.className)).size).toBe(1);

    answer("He");

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Určeno").nextElementSibling).toHaveTextContent("1 z 1");
  });

  it("stops the stopwatch on Ukončit, shows the summary, and returns to the selection", () => {
    vi.useFakeTimers();
    renderPractice();
    fireEvent.click(startButton());

    act(() => vi.advanceTimersByTime(65_000));
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");
    answer("H");
    fireEvent.click(screen.getByRole("button", { name: "Ukončit" }));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Čas").nextElementSibling).toHaveTextContent("01:05");
    expect(within(summary).getByText("Určeno").nextElementSibling).toHaveTextContent("1 z 3");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Ukončit" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");

    fireEvent.click(within(summary).getByRole("button", { name: "Změnit výběr" }));
    expect(startButton()).toHaveTextContent("Přejít na cvičení (3 prvky)");
  });

  it("resets the score, the table, and the stopwatch and starts again", () => {
    vi.useFakeTimers();
    renderPractice();
    fireEvent.click(startButton());
    answer("H");
    answer("X");
    act(() => vi.advanceTimersByTime(12_000));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(cell("Perioda 1, skupina 1")).toHaveTextContent("?");
    expect(cell("Perioda 2, skupina 1")).toHaveTextContent("?");
    expect(prompt()).toHaveAccessibleName("Zadání: Vodík");
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("asks the elements in the injected random order", () => {
    renderPractice([hydrogen, helium, lithium], () => 0);
    fireEvent.click(startButton());

    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
  });

  it("shows a local persistence failure without stopping the exercise", async () => {
    appendAttempt.mockRejectedValueOnce(new Error("Úložiště je uzamčeno."));
    renderPractice();
    fireEvent.click(startButton());

    answer("H");

    await waitFor(() =>
      expect(
        screen.getByText("Pokus se nepodařilo uložit: Úložiště je uzamčeno."),
      ).toBeInTheDocument(),
    );
    expect(prompt()).toHaveAccessibleName("Zadání: Helium");
  });
});
