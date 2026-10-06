import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductionQuiz } from "./production-quiz";

/** Keeps every shuffle in its original order, so the correct option is always listed first. */
const keepOrder = () => 0.999;

function questionCard() {
  return screen.getByRole("region", { name: /^Kterou látku lze takto/u });
}

function options() {
  return within(questionCard()).getAllByRole("button");
}

function progress() {
  return screen.getByRole("progressbar", { name: "Postup cvičením" });
}

function startQuiz() {
  fireEvent.click(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" }));
}

describe("ProductionQuiz", () => {
  afterEach(cleanup);

  it("does not bypass the correction when the final retry is wrong", () => {
    const choose = (index: number) => {
      const option = options()[index];
      if (!option) throw new Error("Missing option");
      fireEvent.click(option);
    };
    render(<ProductionQuiz products={curatedPreparationProduction} random={keepOrder} />);
    startQuiz();
    choose(1);
    for (let index = 0; index < 9; index++) choose(0);
    choose(1);
    const review = screen.getByRole("region", { name: "Poslední odpověď" });
    expect(within(review).getByText("Špatně", { exact: true })).toBeVisible();
    expect(within(review).getByText(/^Vaše odpověď:/u)).toBeVisible();
    expect(within(review).getByText(/^Hledaná látka:/u)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeVisible();
  });

  it("starts with a settings step that shows the number of questions", () => {
    render(<ProductionQuiz products={curatedPreparationProduction} random={keepOrder} />);

    expect(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /^Výroba \(\d+\)$/u }));
    fireEvent.click(screen.getByRole("radio", { name: "Všechny" }));
    expect(screen.getByRole("button", { name: /^Spustit kvíz \(\d+ otázek\)$/u })).toBeEnabled();
  });

  it("returns a wrongly answered question at the end and finishes after it is solved", () => {
    render(<ProductionQuiz products={curatedPreparationProduction} random={keepOrder} />);
    startQuiz();

    expect(options()).toHaveLength(4);
    const firstQuestion = questionCard().textContent;
    const wrong = options()[1];
    if (!wrong) throw new Error("missing option");
    const wrongName = wrong.firstElementChild?.textContent ?? "missing";
    fireEvent.click(wrong);

    expect(screen.getByText("Špatně", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/^Vaše odpověď:/u)).toHaveTextContent(wrongName);
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(progress()).toHaveAttribute("aria-valuetext", "0 z 10");
    expect(options()[0]).toHaveFocus();

    for (let answered = 1; answered <= 9; answered += 1) {
      const [correct] = options();
      if (!correct) throw new Error("missing option");
      fireEvent.click(correct);
      expect(screen.getByText("Správně", { selector: "p" })).toBeInTheDocument();
    }
    expect(progress()).toHaveAttribute("aria-valuetext", "9 z 10");
    expect(questionCard().textContent).toBe(firstQuestion);

    const [correct] = options();
    if (!correct) throw new Error("missing option");
    fireEvent.click(correct);

    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "K zopakování" })).toBeInTheDocument();
  });

  it("stops early and returns to the settings", () => {
    render(<ProductionQuiz products={curatedPreparationProduction} random={keepOrder} />);
    startQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Ukončit" }));

    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Změnit nastavení" }));
    expect(screen.getByRole("region", { name: "Nastavení kvízu" })).toBeInTheDocument();
  });
});
