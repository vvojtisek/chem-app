import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementFlashcardData } from "@inorganic/content/runtime";

const appendAttempt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/browser-progress-store", () => ({
  createBrowserProgressStore: () => ({ appendAttempt }),
}));

import { ElementNamePractice } from "./element-name-practice";

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

afterEach(cleanup);

beforeEach(() => {
  appendAttempt.mockReset();
});

describe("ElementNamePractice", () => {
  it("shows the unavailable-question notice before a session starts", () => {
    render(<ElementNamePractice elements={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cvičení nelze zahájit: chybí ověřené otázky.",
    );
  });

  it("repeats an incorrect answer once and reports both rounds", async () => {
    render(<ElementNamePractice elements={[hydrogen]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "Helium" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));

    expect(screen.getByRole("heading", { name: "Zkusíme to ještě jednou" })).toBeInTheDocument();
    expect(screen.getByText(/H je/)).toHaveTextContent("H je Vodík.");
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenLastCalledWith(
        expect.objectContaining({ round: "initial", isCorrect: false }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Opakování chyby")).toBeInTheDocument();
    expect(screen.getByText("H", { exact: true })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "Vodík" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    await waitFor(() => {
      expect(appendAttempt).toHaveBeenLastCalledWith(
        expect.objectContaining({ round: "retry", isCorrect: true }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByRole("heading", { name: "Cvičení dokončeno" })).toBeInTheDocument();
    expect(
      screen.getByText(/První průchod: 0 správně, 1 chybně\. Opakování: 1 správně, 0 chybně\./),
    ).toBeInTheDocument();
  });

  it("shows a local persistence failure during feedback", async () => {
    appendAttempt.mockRejectedValueOnce(new Error("Úložiště je uzamčeno."));
    render(<ElementNamePractice elements={[hydrogen]} />);

    fireEvent.click(screen.getByRole("button", { name: /začít cvičení/i }));
    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "vodík" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));

    await waitFor(() => {
      expect(appendAttempt).toHaveBeenCalledOnce();
    });

    expect(screen.getByRole("heading", { name: "Správně" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pokus se nepodařilo uložit: Úložiště je uzamčeno.",
    );
  });
});
