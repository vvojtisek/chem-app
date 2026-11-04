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

/** Starts the „reactants → which substance“ direction, which these tests were written for. */
function startQuiz() {
  fireEvent.click(screen.getByRole("radio", { name: "Co vzniká" }));
  fireEvent.click(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" }));
}

function routeCard() {
  return screen.getByRole("region", { name: /^Ze kterých výchozích látek/u });
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
    const wrongName = wrong.querySelector("[data-option-name]")?.textContent ?? "missing";
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

  it("asks how to make a substance by default, with reactant options marked a) to d)", () => {
    render(<ProductionQuiz products={curatedPreparationProduction} random={keepOrder} />);
    expect(screen.getByRole("radio", { name: "Jak látku získat" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" }));

    const card = routeCard();
    const buttons = within(card).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent?.slice(0, 2))).toEqual([
      "a)",
      "b)",
      "c)",
      "d)",
    ]);
    expect(card).toHaveTextContent(/Hledaná látka: /u);
    const [correct] = buttons;
    if (!correct) throw new Error("missing option");
    fireEvent.click(correct);
    expect(screen.getByText("Správně", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/^Správný postup:/u)).toBeInTheDocument();
  });

  it("reorders the options when a missed route question comes back", () => {
    // Keeps the quiz order, then reverses the options of the returning question.
    let reverse = false;
    const random = () => (reverse ? 0 : 0.999);
    render(<ProductionQuiz products={curatedPreparationProduction} random={random} />);
    fireEvent.click(screen.getByRole("radio", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" }));
    const before = within(routeCard())
      .getAllByRole("button")
      .map((button) => button.textContent?.slice(3));
    const firstQuestion = routeCard().getAttribute("data-question-id");
    const wrong = within(routeCard()).getAllByRole("button")[1];
    if (!wrong) throw new Error("missing option");
    fireEvent.click(wrong);
    expect(screen.getByText(/^Vaše odpověď:/u)).toBeInTheDocument();
    for (let answered = 1; answered <= 9; answered += 1) {
      const [correct] = within(routeCard()).getAllByRole("button");
      if (!correct) throw new Error("missing option");
      if (answered === 9) reverse = true;
      fireEvent.click(correct);
    }
    expect(routeCard().getAttribute("data-question-id")).toBe(firstQuestion);
    const after = within(routeCard())
      .getAllByRole("button")
      .map((button) => button.textContent?.slice(3));
    expect([...after].sort()).toEqual([...before].sort());
    expect(after).not.toEqual(before);
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
