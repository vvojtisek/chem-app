import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeRoute,
} from "@inorganic/content/preparation-production";
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

function side(terms: PreparationProductionRuntimeRoute["products"], coefficients = false) {
  return terms
    .map(
      (term) =>
        (coefficients && term.coefficient !== 1 ? `${term.coefficient} ` : "") + term.formula,
    )
    .join(" + ");
}

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

function answer(text: string) {
  const input = within(card()).getByRole("textbox");
  fireEvent.change(input, { target: { value: text } });
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
    expect(screen.getByRole("radio", { name: "Jak látku získat" })).toBeChecked();
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

  it("Pokročilá accepts products in any order without coefficients and fills them in", () => {
    renderQuiz();
    startMode("Pokročilá");
    const route = currentRoute();
    expect(within(card()).getByText("Které produkty vzniknou?")).toBeVisible();
    answer(
      [...route.products]
        .reverse()
        .map((term) => term.formula)
        .join(" + "),
    );
    expect(within(card()).getByText("Správně")).toBeVisible();
    const balanced = card().querySelector("[data-balanced-equation]");
    expect(balanced?.textContent?.replace(/\s/gu, " ")).toContain(
      `${side(route.reactants, true)} → ${side(route.products, true)}`.replace(/\s/gu, " "),
    );
    fireEvent.click(within(card()).getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
  });

  it("Pokročilá marks a wrong product, allows a retry and scores the first check", () => {
    renderQuiz();
    startMode("Pokročilá");
    const route = currentRoute();
    const [first] = route.products;
    if (!first) throw new Error("No product");
    answer(`${first.formula} + Xe`);
    expect(within(card()).getByText("Zatím ne")).toBeVisible();
    expect(within(card()).getByText("nepatří sem")).toBeVisible();
    answer(side(route.products));
    expect(within(card()).getByText("Správně po opravě; počítá se první pokus")).toBeVisible();
    fireEvent.click(within(card()).getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
  });

  it("does not grade an unreadable entry", () => {
    renderQuiz();
    startMode("Pokročilá");
    answer("ZnCl2 & H2");
    expect(within(card()).getByRole("alert")).toHaveTextContent("Zápis nelze přečíst");
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
    expect(within(card()).queryByText("Zatím ne")).not.toBeInTheDocument();
  });

  it("Pro asks in words, accepts an equation without coefficients and lists the alternatives", () => {
    renderQuiz();
    startMode("Pro");
    const { product, routes: accepted } = currentTarget();
    const heading = within(card()).getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/^Jak se (laboratorně připravuje|průmyslově vyrábí) /u);
    expect(heading).toHaveTextContent(product.nameCs.toLocaleLowerCase("cs"));
    const route = accepted.at(-1);
    if (!route) throw new Error("No route");
    answer(`${side(route.reactants)} = ${side(route.products)}`);
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
    expect(
      within(card()).queryByRole("button", { name: "Další nápověda" }),
    ).not.toBeInTheDocument();
  });

  it("Pro reveals every reviewed route on request", () => {
    renderQuiz();
    startMode("Pro");
    const { routes: accepted } = currentTarget();
    answer("H2 -> H2");
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
