import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./math-text", () => ({
  MathText: ({ children }: Readonly<{ children: string }>) => <span>{children}</span>,
}));

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import { MathPracticeSession } from "./practice-session";

const topic = {
  id: "test-limits",
  number: 1,
  title: "Limita funkce a spojitost",
  shortTitle: "Limity a spojitost",
  description: "Základní limity.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Testovací úloha."],
  verificationNote: "Ověřeno dosazením.",
  theory: [],
  solverTypes: [],
  exercises: [
    {
      id: "math.test.limit",
      prompt: "Vypočtěte $\\lim_{x\\to1} x+1$.",
      answer: "2",
      answerLabel: "$2$",
      hints: ["Dosadíme hodnotu do spojité funkce."],
      solutionSteps: ["Funkce $x+1$ je spojitá.", "Dosadíme $x=1$ a dostáváme $2$."],
    },
    {
      id: "math.test.second",
      prompt: "Vypočtěte $1+2$.",
      answer: "3",
      hints: [],
      solutionSteps: ["Sečteme čísla a dostaneme $3$."],
    },
  ],
} as const satisfies MathTopic;

afterEach(cleanup);

describe("MathPracticeSession", () => {
  it("offers hints, retries a wrong answer, checks a correct answer and reveals steps", () => {
    render(<MathPracticeSession topic={topic} />);

    expect(screen.getAllByRole("heading", { level: 2 })[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit nápovědu" }));
    expect(screen.getByText("Dosadíme hodnotu do spojité funkce.")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Vaše odpověď"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("status")).toHaveTextContent("Odpověď zatím nesouhlasí");

    fireEvent.change(screen.getByLabelText("Vaše odpověď"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("status")).toHaveTextContent("Správně.");
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit řešení" }));
    expect(screen.getByRole("heading", { name: "Řešení krok za krokem" })).toBeVisible();
    expect(screen.getByText(/Funkce/)).toBeVisible();
  });

  it("completes the topic and starts a fresh run", () => {
    render(<MathPracticeSession topic={topic} />);

    fireEvent.click(screen.getByRole("button", { name: "Zobrazit řešení" }));
    const nextButton = screen
      .getAllByRole("button", { name: "Další úloha" })
      .find((button) => button.textContent === "Další úloha");
    if (!nextButton) throw new Error("Tlačítko další úlohy chybí.");
    fireEvent.click(nextButton);
    fireEvent.change(screen.getByLabelText("Vaše odpověď"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    fireEvent.click(screen.getByRole("button", { name: "Dokončit okruh" }));

    expect(screen.getByRole("heading", { name: "Okruh dokončen" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Procvičit znovu" }));
    expect(screen.getByText("Úloha 1 z 2")).toBeVisible();
  });

  it("accepts an explicitly equivalent TeX fraction", () => {
    const fractionTopic = {
      ...topic,
      exercises: [{ ...topic.exercises[0], answer: "1/2", answerLabel: "$\\frac12$" }],
    } as const satisfies MathTopic;
    render(<MathPracticeSession topic={fractionTopic} />);

    fireEvent.change(screen.getByLabelText("Vaše odpověď"), {
      target: { value: "\\frac{1}{2}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("status")).toHaveTextContent("Správně.");
  });
});
