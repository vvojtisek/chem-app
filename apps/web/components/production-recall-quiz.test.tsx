import { curatedPreparationProduction } from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PRODUCTION_QUIZ_MODE_KEY } from "@/lib/production-quiz-preferences";

import { ProductionQuiz } from "./production-quiz";

const SYMBOLS = curatedElements.map((element) => element.symbol);
const keepOrder = () => 0.999;
const routes = new Map(
  curatedPreparationProduction.flatMap((product) =>
    product.routes.map((route) => [route.id, route] as const),
  ),
);
const products = new Map(curatedPreparationProduction.map((product) => [product.id, product]));
type Terms = readonly { readonly formula: string }[];
const formulas = (terms: Terms) => [...new Set(terms.map((term) => term.formula))];

function renderQuiz() {
  render(
    <ProductionQuiz
      allowedSymbols={SYMBOLS}
      products={curatedPreparationProduction}
      random={keepOrder}
    />,
  );
}

function startMode(label: "Pokročilá" | "Pro") {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: /^Spustit kvíz/u }));
}

function card() {
  const element = document.querySelector<HTMLElement>("section[data-question-id]");
  if (!element) throw new Error("No question card");
  return element;
}

function slots(label: "Produkt" | "Výchozí látka") {
  return within(card()).getAllByRole("textbox", { name: new RegExp(`^${label} \\d+$`, "u") });
}

function fill(label: "Produkt" | "Výchozí látka", values: readonly string[]) {
  for (const [index, value] of values.entries()) {
    const slot = slots(label)[index];
    if (!slot) throw new Error(`Missing ${label} slot ${index + 1}`);
    fireEvent.change(slot, { target: { value } });
  }
}

function checkAnswer() {
  fireEvent.click(within(card()).getByRole("button", { name: "Zkontrolovat" }));
}

function currentRoute() {
  const route = routes.get(card().dataset.questionId ?? "");
  if (!route) throw new Error("Unknown route");
  return route;
}

function currentTarget() {
  const [productId = "", kind] = (card().dataset.questionId ?? "").split("|");
  const product = products.get(productId);
  if (!product) throw new Error("Unknown product");
  return {
    product,
    routes: product.routes.filter(
      (route) =>
        route.kind === kind && route.products.some((term) => term.formula === product.formula),
    ),
  };
}

describe("ProductionQuiz difficulty modes", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("offers Lehká, Pokročilá and Pro, with Lehká as the default", () => {
    renderQuiz();
    expect(screen.getByRole("radio", { name: "Lehká" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pokročilá" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Pro" })).not.toBeChecked();
  });

  it("remembers the chosen difficulty", () => {
    renderQuiz();
    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(JSON.parse(window.localStorage.getItem(PRODUCTION_QUIZ_MODE_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      mode: "pro",
    });
    cleanup();
    renderQuiz();
    expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked();
  });

  it("Pokročilá shows one slot per product after the arrow and fills in the coefficients", () => {
    renderQuiz();
    startMode("Pokročilá");
    const route = currentRoute();
    const expected = formulas(route.products);
    expect(slots("Produkt")).toHaveLength(expected.length);
    expect(slots("Produkt")[0]).toHaveFocus();
    fill("Produkt", [...expected].reverse());
    checkAnswer();
    expect(within(card()).getByText("Správně")).toBeVisible();
    for (const slot of slots("Produkt")) expect(slot).toBeDisabled();
    const shownCoefficients = [...card().querySelectorAll("[data-slot-row] [data-coefficient]")]
      .map((element) => Number(element.textContent))
      .sort();
    expect(shownCoefficients).toEqual(
      [...route.reactants, ...route.products]
        .map((term) => term.coefficient)
        .filter((coefficient) => coefficient !== 1)
        .sort(),
    );
    fireEvent.click(within(card()).getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
  });

  it("Pokročilá marks a wrong slot, allows a retry and scores the first check", () => {
    renderQuiz();
    startMode("Pokročilá");
    const expected = formulas(currentRoute().products);
    fill("Produkt", ["Xe", ...expected.slice(1)]);
    checkAnswer();
    expect(within(card()).getByText("Zatím ne")).toBeVisible();
    expect(within(card()).getByText("nepatří sem")).toBeVisible();
    expect(slots("Produkt")[0]).toHaveAttribute("aria-invalid", "true");
    fill("Produkt", expected);
    checkAnswer();
    expect(within(card()).getByText("Správně po opravě; počítá se první pokus")).toBeVisible();
    fireEvent.click(within(card()).getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
  });

  it("moves to the next slot on + and does not grade an unreadable slot", () => {
    renderQuiz();
    startMode("Pro");
    const [first, second] = slots("Výchozí látka");
    if (!first || !second) throw new Error("Expected two reactant slots");
    first.focus();
    fireEvent.keyDown(first, { key: "+" });
    expect(second).toHaveFocus();
    fill("Výchozí látka", ["Zn&", "HCl"]);
    fill("Produkt", ["H2"]);
    checkAnswer();
    expect(within(card()).getByRole("alert")).toHaveTextContent("nelze přečíst");
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(within(card()).queryByText("Zatím ne")).not.toBeInTheDocument();
  });

  it("Pro asks in words and accepts any reviewed route, ignoring typed coefficients", () => {
    renderQuiz();
    startMode("Pro");
    const { product, routes: accepted } = currentTarget();
    const heading = within(card()).getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/^Jak se (laboratorně připravuje|průmyslově vyrábí) /u);
    expect(heading).toHaveTextContent(product.nameCs.toLocaleLowerCase("cs"));
    const route = accepted.at(-1);
    if (!route) throw new Error("No route");
    const resize = (label: string, count: number) => {
      const group = label === "výchozí látka" ? "Výchozí látka" : "Produkt";
      while (slots(group).length < count)
        fireEvent.click(within(card()).getByRole("button", { name: `+ ${label}` }));
      while (slots(group).length > count)
        fireEvent.click(within(card()).getByRole("button", { name: `− ${label}` }));
    };
    resize("výchozí látka", formulas(route.reactants).length);
    resize("produkt", formulas(route.products).length);
    fill(
      "Výchozí látka",
      route.reactants.map((term) => `${term.coefficient + 1} ${term.formula}`),
    );
    fill("Produkt", formulas(route.products).reverse());
    checkAnswer();
    expect(within(card()).getByText("Správně")).toBeVisible();
    expect(within(card()).getByText(/^Vyčíslená rovnice:/u)).toBeVisible();
    if (accepted.length > 1) {
      expect(within(card()).getByText("Další ověřené postupy:")).toBeVisible();
    }
  });

  it("Pro hints reveal the reactants first and then the unbalanced pathway", () => {
    renderQuiz();
    startMode("Pro");
    fireEvent.click(within(card()).getByRole("button", { name: "Nápověda" }));
    expect(within(card()).getByText(/^Výchozí látky:/u)).toBeVisible();
    fireEvent.click(within(card()).getByRole("button", { name: "Další nápověda" }));
    expect(within(card()).getByText(/^Postup bez koeficientů:/u)).toBeVisible();
  });

  it("Pro reveals every reviewed route on request", () => {
    renderQuiz();
    startMode("Pro");
    const { routes: accepted } = currentTarget();
    fill("Výchozí látka", ["H2"]);
    fill("Produkt", ["H2"]);
    checkAnswer();
    fireEvent.click(within(card()).getByRole("button", { name: "Ukázat řešení" }));
    expect(within(card()).getByText("Ověřené postupy:")).toBeVisible();
    expect(card().querySelectorAll("li [data-balanced-equation]")).toHaveLength(accepted.length);
  });

  it("starts a new quiz in the chosen difficulty when it is switched during a quiz", () => {
    renderQuiz();
    startMode("Pokročilá");
    expect(within(card()).getByText("Které produkty vzniknou?")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(within(card()).getByRole("heading", { level: 2 }).textContent).toMatch(/^Jak se /u);
    fireEvent.click(screen.getByRole("radio", { name: "Lehká" }));
    expect(screen.getByRole("list", { name: "Možnosti odpovědi" })).toBeVisible();
  });
});
