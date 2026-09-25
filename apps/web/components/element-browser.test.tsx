import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ElementBrowser } from "./element-browser";

function element(
  atomicNumber: number,
  symbol: string,
  nameCs: string,
  group: number | null,
  period: number,
): ElementFlashcardData {
  return {
    id: `element.${atomicNumber}`,
    atomicNumber,
    symbol,
    nameCs,
    nameLat: `${nameCs}um`,
    period,
    group,
    atomicWeight: 1.008,
    valenceConfiguration: "1s1",
  };
}

const elements = [
  element(1, "H", "Vodík", 1, 1),
  element(3, "Li", "Lithium", 1, 2),
  element(2, "He", "Helium", 18, 1),
  element(57, "La", "Lanthan", null, 6),
];
const groups: ElementGroupData[] = [
  { groupNumber: 1, nameCs: "Alkalické kovy", mnemonicCs: "Testovací pomůcka skupiny 1" },
  { groupNumber: 18, nameCs: "Vzácné plyny", mnemonicCs: "Testovací pomůcka skupiny 18" },
];
const hydrogen: PreparationProductionRuntimeProduct = {
  id: "preparation-production.product.hydrogen",
  nameCs: "Vodík",
  formula: "H2",
  notes: [],
  routes: [
    {
      id: "preparation-production.route.hydrogen",
      sourceId: "id-hydrogen",
      kind: "manufacture",
      reactants: [
        { coefficient: 1, formula: "Zn" },
        { coefficient: 2, formula: "HCl" },
      ],
      products: [
        { coefficient: 1, formula: "H2" },
        { coefficient: 1, formula: "ZnCl2" },
      ],
      conditionsCs: null,
    },
  ],
  reviewLevel: "owner-approved",
  sources: [{ title: "Fixture", locator: "https://example.test/source" }],
};

afterEach(cleanup);

function renderBrowser() {
  render(<ElementBrowser elements={elements} groups={groups} production={{ H: [hydrogen] }} />);
}

function results() {
  return screen.getByRole("list", { name: "Výsledky hledání" });
}

function detail() {
  return screen.getByRole("region", { name: /^Vodík|^Lithium|^Helium|^Lanthan/ });
}

describe("ElementBrowser", () => {
  it("shows the first element with its facts, group mnemonic and typeset production", () => {
    renderBrowser();

    expect(within(results()).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("Nalezeno: 4 prvky")).toBeInTheDocument();
    const card = detail();
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent("Vodík (H)");
    expect(within(card).getByText("1. skupina – Alkalické kovy")).toBeInTheDocument();
    expect(within(card).getByText("Testovací pomůcka skupiny 1")).toBeInTheDocument();
    expect(within(card).getAllByRole("img", { name: "ZnCl2" })).toHaveLength(1);
  });

  it("finds an element by name without diacritics and opens it", () => {
    renderBrowser();

    fireEvent.change(screen.getByRole("searchbox", { name: "Hledat prvek" }), {
      target: { value: "lith" },
    });
    expect(screen.getByText("Nalezeno: 1 prvek")).toBeInTheDocument();
    fireEvent.click(within(results()).getByRole("button", { name: /Lithium/ }));

    expect(within(results()).getByRole("button", { name: /Lithium/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(detail()).getByRole("heading", { level: 2 })).toHaveTextContent("Lithium");
    expect(
      within(detail()).getByText("Příprava ani výroba tohoto prvku v učivu uvedena není."),
    ).toBeInTheDocument();
  });

  it("filters by group with its mnemonic and by the rows without a group number", () => {
    renderBrowser();
    const group = screen.getByRole("combobox", { name: "Skupina" });

    fireEvent.change(group, { target: { value: "18" } });
    expect(within(results()).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Skupina 18" })).toHaveTextContent(
      "Testovací pomůcka skupiny 18",
    );

    fireEvent.change(group, { target: { value: "f" } });
    expect(within(results()).getByRole("button", { name: /Lanthan/ })).toBeInTheDocument();
    expect(screen.getByText(/nemají číslo skupiny/)).toBeInTheDocument();
  });

  it("explains an empty result and clears the filters", () => {
    renderBrowser();

    fireEvent.change(screen.getByRole("searchbox", { name: "Hledat prvek" }), {
      target: { value: "xyz" },
    });
    expect(screen.getByText(/Žádný prvek neodpovídá hledání/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zrušit filtry" }));

    expect(within(results()).getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Zrušit filtry" })).toBeNull();
  });
});
