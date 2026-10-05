import { curatedBalancingReactionLessons } from "@inorganic/content/balancing-reactions";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getElementColor } from "@/lib/element-display-colors";
import { BalancingReactionsLesson } from "./balancing-reactions-lesson";

afterEach(cleanup);
const nextStep = () => fireEvent.click(screen.getByRole("button", { name: /Další krok/ }));

describe("BalancingReactionsLesson", () => {
  it("resolves both fluorine badges together and remembers a deliberately resolved one", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "reaction.balancing.cat-1-02" },
    });
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
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
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
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    for (const symbol of ["Na", "B", "O", "H", "Cl"]) {
      const elements = document.querySelectorAll(`[data-element="${symbol}"]`);
      expect(elements.length).toBeGreaterThanOrEqual(2);
      for (const element of elements)
        expect(element).toHaveStyle({ color: getElementColor(symbol) });
    }
  });

  it("includes all 13 iodine pages, three-state badges, charge and follow-up explanations", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    fireEvent.click(screen.getByRole("button", { name: /4\.\s*Disproporcionační/ }));
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
    expect(screen.getByRole("button", { name: /Další krok/ })).toBeDisabled();
  });

  it("does not hijack arrow keys used to select a reaction", () => {
    render(<BalancingReactionsLesson lessons={curatedBalancingReactionLessons} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowRight" });
    expect(screen.getByText("Krok 1 z 7")).toBeVisible();
  });
});
