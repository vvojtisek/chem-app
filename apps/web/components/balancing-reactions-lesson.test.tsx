import { curatedBalancingReactionLessons } from "@inorganic/content/balancing-reactions";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getElementColor } from "@/lib/element-display-colors";
import { BalancingReactionsLesson } from "./balancing-reactions-lesson";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
const nextStep = () => fireEvent.click(screen.getByRole("button", { name: /Další krok/ }));

function lessonById(id: string) {
  const lesson = curatedBalancingReactionLessons.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`Missing lesson ${id}`);
  return lesson;
}

function lessonCheckbox(id: string): HTMLInputElement {
  const checkbox = document.querySelector<HTMLInputElement>(
    `input[type="checkbox"][value="${id}"]`,
  );
  if (!checkbox) throw new Error(`Missing checkbox for ${id}`);
  return checkbox;
}

function chooseCategory(category: number) {
  const nav = screen.getByRole("navigation", { name: "Kategorie reakcí" });
  fireEvent.click(within(nav).getByRole("button", { name: new RegExp(`^${category}\\.`) }));
}

/** Renders the lesson, picks the given equations in the picker and starts the set. */
function practise(...ids: string[]) {
  render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
  for (const id of ids) {
    chooseCategory(lessonById(id).category);
    fireEvent.click(lessonCheckbox(id));
  }
  fireEvent.click(screen.getByRole("button", { name: "Začít procvičovat" }));
}

describe("BalancingReactionsLesson", () => {
  it("resolves both fluorine badges together and remembers a deliberately resolved one", () => {
    practise("reaction.balancing.cat-1-02");
    expect(screen.getByText("Krok 1 z 5")).toBeVisible();
    nextStep();
    expect(document.querySelectorAll('[data-coefficient-state="active"]')).toHaveLength(2);
    expect(document.querySelector('[data-coefficient="4"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    expect(document.querySelector('[data-coefficient="3"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    nextStep();
    expect(
      document.querySelector('[data-coefficient="1"][data-coefficient-state="active"]'),
    ).not.toBeNull();
    nextStep();
    expect(
      document.querySelector('[data-coefficient="1"][data-coefficient-state="resolved"]'),
    ).not.toBeNull();
    expect(screen.getAllByText("✓ Vyčísleno")).toHaveLength(4);
  });
  it("starts borax with all coefficients 1 and conceptual explanation before balancing", () => {
    practise("reaction.balancing.boric-acid");
    expect(screen.getByText("Krok 1 z 7")).toBeVisible();
    expect(screen.getByText(/Aktuální krok: Spočítejte atomy a náboj/)).toBeVisible();
    expect(
      document.querySelectorAll('[data-coefficient="1"][data-coefficient-state="unresolved"]'),
    ).toHaveLength(5);
    expect(within(screen.getByRole("listitem", { name: "B" })).getByText("4 vs 1")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    nextStep();
    expect(screen.getByText(/Aktuální krok: Zachováváme atomy/)).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Krok 3 z 7")).toBeVisible();
    expect(document.querySelector('[data-coefficient="4"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    nextStep();
    expect(document.querySelector('[data-coefficient="4"]')).toHaveAttribute(
      "data-coefficient-state",
      "resolved",
    );
    expect(document.querySelector('[data-coefficient="2"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(document.querySelector('[data-coefficient="4"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
  });

  it("uses the same element palette in the equation and summary cards", () => {
    practise("reaction.balancing.boric-acid");
    for (const symbol of ["Na", "B", "O", "H", "Cl"]) {
      const elements = document.querySelectorAll(`[data-element="${symbol}"]`);
      expect(elements.length).toBeGreaterThanOrEqual(2);
      for (const element of elements)
        expect(element).toHaveStyle({ color: getElementColor(symbol) });
    }
  });

  it("includes all 13 iodine pages, three-state badges, charge and follow-up explanations", () => {
    practise("reaction.balancing.iodine-synproportionation");
    expect(screen.getByText("Krok 1 z 14")).toBeVisible();
    expect(
      within(screen.getByRole("listitem", { name: "Náboj" })).getByText("-1 vs 0"),
    ).toBeVisible();
    expect(document.querySelectorAll('[data-coefficient="1"]')).toHaveLength(5);
    nextStep();
    expect(screen.getByText(/Aktuální krok: Zachováváme atomy i náboj/)).toBeVisible();
    nextStep();
    nextStep();
    expect(document.querySelectorAll('[data-coefficient-state="active"]')).toHaveLength(0);
    nextStep();
    expect(
      within(screen.getByRole("listitem", { name: "Náboj" })).getByText("+4 vs 0"),
    ).toBeVisible();
    expect(document.querySelector('[data-coefficient="3"]')).toBeNull();
    expect(document.querySelector('[data-coefficient="6"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    nextStep();
    expect(within(screen.getByRole("listitem", { name: "I" })).getByText("6 vs 2")).toBeVisible();
    nextStep();
    expect(document.querySelector('[data-coefficient="3"]')).toHaveAttribute(
      "data-coefficient-state",
      "active",
    );
    nextStep();
    expect(screen.getAllByText("✓ Vyčísleno")).toHaveLength(4);
    nextStep();
    nextStep();
    expect(screen.getByText(/IO3\^-:.*přijímá 5 e/)).toBeVisible();
    nextStep();
    expect(screen.getByText(/Aktuální krok: Koeficienty jsou molární poměry/)).toBeVisible();
    nextStep();
    expect(screen.getByText(/0,00280 mol/)).toBeVisible();
    nextStep();
    expect(screen.getByText("Krok 13 z 14")).toBeVisible();
    expect(
      within(screen.getByRole("listitem", { name: "Náboj" })).getByText("-3 = -3"),
    ).toBeVisible();
    nextStep();
    expect(screen.getByText("Krok 14 z 14")).toBeVisible();
    expect(
      document.querySelectorAll(
        '[data-coefficient-state="resolved"][data-coefficient-final="true"]',
      ),
    ).toHaveLength(5);
    expect(screen.getAllByText("✓ Vyčísleno")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Další krok/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dokončit sadu →" })).toBeVisible();
  });

  it("starts in the picker with rendered formulas and no step until equations are chosen", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    expect(screen.getByRole("heading", { name: "Vyberte rovnice k procvičení" })).toBeVisible();
    expect(screen.queryByText(/Krok 1 z/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Začít procvičovat" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Vybráno: 0 rovnic");

    chooseCategory(2);
    const checkbox = lessonCheckbox("reaction.balancing.cat-2-01");
    const label = checkbox.closest("label");
    expect(label).toHaveTextContent("Reakce 2.1: PbO2 + Mn2+ + H+ → ...");
    expect(label?.querySelector("sub")).toHaveTextContent("2");
    expect(label).not.toHaveTextContent("^");
    fireEvent.click(checkbox);
    expect(screen.getByRole("status")).toHaveTextContent("Vybráno: 1 rovnice");
    expect(screen.getByRole("button", { name: /^2\..*vybráno 1/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Začít procvičovat" })).toBeEnabled();
  });

  it("selects a whole category and walks the set equation by equation to the end", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    chooseCategory(6);
    const special = curatedBalancingReactionLessons.filter((lesson) => lesson.category === 6);
    fireEvent.click(screen.getByRole("button", { name: `Vybrat všech ${special.length}` }));
    expect(screen.getByRole("status")).toHaveTextContent(`Vybráno: ${special.length} rovnic`);
    fireEvent.click(screen.getByRole("button", { name: "Zrušit výběr kategorie" }));
    expect(screen.getByRole("status")).toHaveTextContent("Vybráno: 0 rovnic");

    const [first, second] = special;
    if (!first || !second) throw new Error("Category 6 needs two lessons");
    fireEvent.click(lessonCheckbox(first.id));
    fireEvent.click(lessonCheckbox(second.id));
    fireEvent.click(screen.getByRole("button", { name: "Začít procvičovat" }));

    expect(screen.getByText("Rovnice 1 z 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Na shrnutí" }));
    expect(screen.getByText(`Krok ${first.steps.length} z ${first.steps.length}`)).toBeVisible();
    expect(screen.getByRole("button", { name: "Na shrnutí" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Další rovnice →" }));

    expect(screen.getByText("Rovnice 2 z 2")).toBeVisible();
    expect(screen.getByText(`Krok 1 z ${second.steps.length}`)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Na shrnutí" }));
    fireEvent.click(screen.getByRole("button", { name: "Dokončit sadu →" }));

    expect(screen.getByRole("heading", { name: "Sada je hotová" })).toHaveFocus();
    expect(screen.getByText(/Prošli jste 2 rovnice/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Projít znovu" }));
    expect(screen.getByText("Rovnice 1 z 2")).toBeVisible();
    expect(screen.getByText(`Krok 1 z ${first.steps.length}`)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "← Výběr rovnic" }));
    expect(screen.getByRole("heading", { name: "Vyberte rovnice k procvičení" })).toHaveFocus();
    expect(lessonCheckbox(first.id)).toBeChecked();
    expect(lessonCheckbox(first.id).closest("label")).toHaveTextContent("✓ prošlá");
    expect(lessonCheckbox(special[2]?.id ?? "").closest("label")).not.toHaveTextContent("prošlá");
  });

  it("moves to the next equation with the right arrow on the summary", () => {
    practise("reaction.balancing.cat-1-02", "reaction.balancing.boric-acid");
    const first = lessonById("reaction.balancing.boric-acid");
    expect(screen.getByText(`Krok 1 z ${first.steps.length}`)).toBeVisible();
    for (let step = 1; step < first.steps.length; step++)
      fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText(/Aktuální krok: Závěrečné shrnutí/)).toBeVisible();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Rovnice 2 z 2")).toBeVisible();
    expect(screen.getByText("Krok 1 z 5")).toBeVisible();
  });

  it("remembers the chosen equations after a reload", () => {
    practise("reaction.balancing.cat-2-01", "reaction.balancing.cat-3-01");
    cleanup();
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    expect(screen.getByRole("status")).toHaveTextContent("Vybráno: 2 rovnice");
    chooseCategory(3);
    expect(lessonCheckbox("reaction.balancing.cat-3-01")).toBeChecked();
  });

  it("does not hijack arrow keys used on the equation checkboxes", () => {
    practise("reaction.balancing.boric-acid");
    fireEvent.click(screen.getByRole("button", { name: "← Výběr rovnic" }));
    fireEvent.keyDown(lessonCheckbox("reaction.balancing.boric-acid"), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Vyberte rovnice k procvičení" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Začít procvičovat" }));
    fireEvent.keyDown(screen.getByRole("button", { name: /Další krok/ }), { key: "ArrowRight" });
    expect(screen.getByText("Krok 2 z 7")).toBeVisible();
  });
});
