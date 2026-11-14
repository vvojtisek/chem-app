import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProductionQuiz } from "./production-quiz";

const SYMBOLS = curatedElements.map((element) => element.symbol);
const routes = new Map(
  curatedPreparationProduction.flatMap((product) =>
    product.routes.map((route) => [route.id, route] as const),
  ),
);

/** Keeps every shuffle in its original order, so the correct option is always listed first. */
const keepOrder = () => 0.999;

function renderQuiz(random: () => number = keepOrder) {
  render(
    <ProductionQuiz
      allowedSymbols={SYMBOLS}
      products={curatedPreparationProduction}
      random={random}
    />,
  );
}

function questionCard() {
  return screen.getByRole("region", { name: "Které produkty touto reakcí vzniknou?" });
}

function options() {
  return within(
    within(questionCard()).getByRole("list", { name: "Možnosti odpovědi" }),
  ).getAllByRole("button");
}

function option(index: number) {
  const button = options()[index];
  if (!button) throw new Error(`Missing option ${index}`);
  return button;
}

function progress() {
  return screen.getByRole("progressbar", { name: "Postup cvičením" });
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" }));
}

describe("ProductionQuiz Lehká", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("starts with a settings step that shows the number of questions", () => {
    renderQuiz();
    expect(screen.getByRole("radio", { name: "Lehká" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Jak látku získat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spustit kvíz (10 otázek)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /^Výroba \(\d+\)$/u }));
    fireEvent.click(screen.getByRole("radio", { name: "Všechny" }));
    expect(screen.getByRole("button", { name: /^Spustit kvíz \(\d+ otázek\)$/u })).toBeEnabled();
  });

  it("shows the reactants with coefficients and offers product sets a) to d)", () => {
    renderQuiz();
    start();
    const route = routes.get(questionCard().dataset.questionId ?? "");
    if (!route) throw new Error("Unknown route");
    const shown = within(questionCard()).getByText(/^Výchozí látky:/u).parentElement;
    for (const term of route.reactants) {
      expect(shown).toHaveTextContent(term.formula);
    }
    expect(options()).toHaveLength(4);
    expect(options().map((button) => button.textContent?.slice(0, 2))).toEqual([
      "a)",
      "b)",
      "c)",
      "d)",
    ]);
    const answerFormulas = [...new Set(route.products.map((term) => term.formula))].sort();
    expect(option(0).dataset.optionId).toBe(answerFormulas.join("+"));
    fireEvent.click(option(0));
    expect(screen.getByText("Správně", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/^Celá rovnice:/u)).toBeInTheDocument();
  });

  it("returns a wrongly answered question at the end and reviews the final answer", () => {
    renderQuiz();
    start();
    const firstQuestion = questionCard().dataset.questionId;
    fireEvent.click(option(1));
    expect(screen.getByText("Špatně", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/^Vaše odpověď:/u)).toBeInTheDocument();
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(progress()).toHaveAttribute("aria-valuetext", "0 z 10");
    expect(option(0)).toHaveFocus();

    for (let answered = 1; answered <= 9; answered += 1) fireEvent.click(option(0));
    expect(progress()).toHaveAttribute("aria-valuetext", "9 z 10");
    expect(questionCard().dataset.questionId).toBe(firstQuestion);
    expect(within(questionCard()).queryByRole("button", { name: "Přeskočit" })).toBeNull();

    fireEvent.click(option(1));
    const review = screen.getByRole("region", { name: "Poslední odpověď" });
    expect(within(review).getByText("Špatně", { exact: true })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "K zopakování" })).toBeInTheDocument();
  });

  it("reorders the options when a missed question comes back", () => {
    let reverse = false;
    renderQuiz(() => (reverse ? 0 : 0.999));
    start();
    const before = options().map((button) => button.dataset.optionId);
    fireEvent.click(option(1));
    for (let answered = 1; answered <= 9; answered += 1) {
      if (answered === 9) reverse = true;
      fireEvent.click(option(0));
    }
    const after = options().map((button) => button.dataset.optionId);
    expect([...after].sort()).toEqual([...before].sort());
    expect(after).not.toEqual(before);
  });

  it("hints the products from the reviewed route and skips without grading", () => {
    renderQuiz();
    start();
    const firstQuestion = questionCard().dataset.questionId;
    fireEvent.click(within(questionCard()).getByRole("button", { name: "Nápověda" }));
    expect(within(questionCard()).getByText(/^Vzniká|^Vznikají/u)).toBeInTheDocument();
    fireEvent.click(within(questionCard()).getByRole("button", { name: "Přeskočit" }));
    expect(questionCard().dataset.questionId).not.toBe(firstQuestion);
    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
  });
});
