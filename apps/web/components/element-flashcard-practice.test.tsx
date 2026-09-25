import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { ElementFlashcardPractice } from "./element-flashcard-practice";

const elements: readonly ElementFlashcardData[] = [
  {
    id: "element.001-h",
    atomicNumber: 1,
    symbol: "H",
    nameCs: "Vodík",
    nameLat: "Hydrogenium",
    period: 1,
    group: 1,
    atomicWeight: 1.008,
    valenceConfiguration: "1s1",
  },
  {
    id: "element.002-he",
    atomicNumber: 2,
    symbol: "He",
    nameCs: "Helium",
    nameLat: "Helium",
    period: 1,
    group: 18,
    atomicWeight: 4.0026,
    valenceConfiguration: "1s2",
  },
  {
    id: "element.003-li",
    atomicNumber: 3,
    symbol: "Li",
    nameCs: "Lithium",
    nameLat: "Lithium",
    period: 2,
    group: 1,
    atomicWeight: 6.94,
    valenceConfiguration: "2s1",
  },
];

beforeEach(() => window.localStorage.clear());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ElementFlashcardPractice", () => {
  it("uses the shared element selection, shuffles cards, and grades a typed symbol", () => {
    render(<ElementFlashcardPractice elements={elements} random={() => 0} />);
    fireEvent.click(screen.getByRole("button", { name: "Lithium (Li)" }));
    fireEvent.click(screen.getByRole("button", { name: "Přejít na cvičení (2 prvky)" }));

    expect(screen.getByRole("timer")).toHaveTextContent("05:00");
    expect(screen.getByRole("heading", { name: "Helium" })).toBeInTheDocument();
    const answer = screen.getByRole("textbox", { name: "Chemická značka" });
    fireEvent.change(answer, { target: { value: "He" } });
    const form = answer.closest("form");
    if (!form) throw new Error("The answer input is not in a form.");
    fireEvent.submit(form);

    expect(screen.getByRole("status")).toHaveTextContent("Správně.");
    expect(screen.getByText("He", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(screen.getByText("Zbývá: 1")).toBeInTheDocument();
  });

  it("counts Nevím as incorrect and evaluates the session after the final card", () => {
    render(<ElementFlashcardPractice elements={elements.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Přejít na cvičení (1 prvek)" }));
    fireEvent.click(screen.getByRole("button", { name: "Nevím" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nevadí, příště to vyjde.");
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.getByText("Zbývá: 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Další" }));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(summary).toHaveTextContent("Špatně");
    expect(summary).toHaveTextContent("1 z 1");
  });

  it("restarts the same selection and stops after five minutes", () => {
    vi.useFakeTimers();
    render(<ElementFlashcardPractice elements={elements.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Přejít na cvičení (1 prvek)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chemická značka" }), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter · Otočit" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("05:00");

    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(screen.getByRole("region", { name: "Vyhodnocení cvičení" })).toBeVisible();
    expect(screen.getByText("05:00")).toBeInTheDocument();
  });
});
