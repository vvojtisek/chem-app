import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  resetLearningDatabase,
  transactionCompleted,
} from "@/lib/browser-learning-database";
import { createBrowserNomenclatureStore } from "@/lib/browser-nomenclature-store";
import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { NOMENCLATURE_FILTERS_KEY } from "@/lib/nomenclature-preferences";
import { NomenclaturePractice } from "./nomenclature-practice";

function record(overrides: Partial<NomenclatureRuntimeRecord>): NomenclatureRuntimeRecord {
  return {
    id: "nomenclature.fixture",
    reviewLevel: "owner-approved",
    formula: "AgCl",
    charge: 0,
    nameCs: "chlorid stříbrný",
    explanationCs: "Fixture explanation.",
    category: "binary-salt",
    elementCount: 2,
    anionFamily: "chlorid",
    tags: [],
    contextCs: null,
    directions: ["formula-to-name", "name-to-formula"],
    nameAliases: [],
    formulaAliases: [],
    ...overrides,
  };
}

const silverChloride = record({ id: "nomenclature.fixture-agcl" });
const sodiumChloride = record({
  id: "nomenclature.fixture-nacl",
  formula: "NaCl",
  nameCs: "chlorid sodný",
  explanationCs: "Kation Na(+I), anion Cl(-I).",
});
const hydrate = record({
  id: "nomenclature.fixture-mgcl2",
  formula: "MgCl2·6H2O",
  nameCs: "hexahydrát chloridu hořečnatého",
  elementCount: 4,
});
const sulfate = record({
  id: "nomenclature.fixture-so4",
  formula: "SO4",
  charge: -2,
  nameCs: "anion síranový",
  category: "element-ion",
  anionFamily: null,
  directions: ["formula-to-name"],
});
const potassiumBromide = record({
  id: "nomenclature.fixture-kbr",
  formula: "KBr",
  nameCs: "bromid draselný",
  anionFamily: "bromid",
});
const keepOrder = () => 0.999_999;
const symbols = ["Ag", "Br", "Cl", "H", "K", "Mg", "Na", "O", "S"];

afterEach(cleanup);
beforeEach(async () => {
  window.localStorage.clear();
  await resetLearningDatabase(indexedDB);
});

function renderPractice(
  compounds: readonly NomenclatureRuntimeRecord[] = [silverChloride, sodiumChloride],
  contentVersion = "fixture-v1",
) {
  return render(
    <NomenclaturePractice
      compounds={compounds}
      contentVersion={contentVersion}
      elementSymbols={symbols}
      random={keepOrder}
    />,
  );
}

async function startButton(): Promise<HTMLElement> {
  return screen.findByRole("button", { name: /^Spustit cvičení/ });
}

function answer(value: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  const form = input.closest("form");
  if (!form) throw new Error("The answer input is not in a form.");
  fireEvent.submit(form);
}

function prompt(): HTMLElement {
  return screen.getByRole("heading", { name: /^Zadání:/ });
}

describe("NomenclaturePractice filters", () => {
  it("counts the matching compounds per category and on the start button", async () => {
    renderPractice([silverChloride, sodiumChloride, hydrate, sulfate]);

    expect(await startButton()).toHaveTextContent("Spustit cvičení (4 sloučeniny)");
    expect(screen.getByRole("button", { name: /Soli bezkyslíkatých kyselin/ })).toHaveTextContent(
      "(3)",
    );
    fireEvent.click(screen.getByRole("radio", { name: "2" }));
    expect(await startButton()).toHaveTextContent("Spustit cvičení (3 sloučeniny)");
    fireEvent.click(screen.getByRole("button", { name: /Prvky a jednoduché ionty/ }));
    expect(await startButton()).toHaveTextContent("Spustit cvičení (2 sloučeniny)");
    fireEvent.click(screen.getByRole("radio", { name: "1" }));
    expect(await startButton()).toBeDisabled();
    expect(screen.getByText(/neodpovídá žádná látka/)).toBeInTheDocument();
  });

  it("narrows a salt category with a quick family selection and remembers the filters", async () => {
    const chlorides = [
      silverChloride,
      sodiumChloride,
      record({ id: "nomenclature.fixture-kcl", formula: "KCl", nameCs: "chlorid draselný" }),
      potassiumBromide,
    ];
    renderPractice(chlorides);

    fireEvent.click(await screen.findByRole("button", { name: /Chloridy/ }));
    expect(await startButton()).toHaveTextContent("Spustit cvičení (3 sloučeniny)");
    expect(
      JSON.parse(window.localStorage.getItem(NOMENCLATURE_FILTERS_KEY) ?? "null"),
    ).toMatchObject({ schemaVersion: 1, filters: { families: ["binary-salt:chlorid"] } });

    cleanup();
    renderPractice(chlorides);
    expect(await startButton()).toHaveTextContent("Spustit cvičení (3 sloučeniny)");
    expect(screen.getByRole("button", { name: /Chloridy/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("NomenclaturePractice exercise", () => {
  it("asks directly with a focused input, accepts a lenient name, and records the attempt", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    expect(prompt()).toHaveAccessibleName("Zadání: AgCl");
    expect(screen.getByRole("textbox", { name: "Český název" })).toHaveFocus();
    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");

    answer("  CHLORID   stribrny ");

    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: NaCl");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText(/Přesný zápis: chlorid stříbrný/)).toBeInTheDocument();
    await waitFor(async () =>
      expect(await createBrowserProgressStore().listAttempts()).toEqual([
        expect.objectContaining({
          compoundId: silverChloride.id,
          questionId: `${silverChloride.id}.formula-to-name`,
          isCorrect: true,
          round: "initial",
          match: "normalized",
          matchPolicy: "name-lenient",
        }),
      ]),
    );
  });

  it("accepts a hydrate name without diacritics or spaces", async () => {
    renderPractice([hydrate]);
    fireEvent.click(await startButton());
    expect(prompt()).toHaveTextContent("MgCl₂·6H₂O");

    answer("hexahydratchloriduhorecnateho");

    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeInTheDocument();
  });

  it("shows the correct answer and explanation after a mistake and asks the item again", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    answer("chlorid sodný");

    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.getByText("Špatně: AgCl = chlorid stříbrný.")).toBeInTheDocument();
    expect(screen.getByText("Fixture explanation.")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: NaCl");

    answer("chlorid sodný");
    expect(prompt()).toHaveAccessibleName("Zadání: AgCl");
    answer("chlorid stříbrný");

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Zodpovězeno").nextElementSibling).toHaveTextContent("2 z 2");
    await waitFor(async () =>
      expect((await createBrowserProgressStore().listAttempts()).at(-1)).toMatchObject({
        compoundId: silverChloride.id,
        round: "retry",
        isCorrect: true,
      }),
    );
    expect(await createBrowserNomenclatureStore().load()).toBeNull();
  });

  it("asks for formulas in the name-to-formula direction but keeps ions formula-to-name", async () => {
    renderPractice([sodiumChloride, sulfate]);
    fireEvent.click(await startButton());
    fireEvent.click(screen.getByRole("radio", { name: "Název → Vzorec" }));

    expect(prompt()).toHaveAccessibleName("Zadání: chlorid sodný");
    fireEvent.change(screen.getByRole("textbox", { name: "Chemický vzorec" }), {
      target: { value: "NaCl" },
    });
    expect(screen.getByText(/Náhled/)).toHaveTextContent("NaCl");
    answer("nacl");
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();

    expect(prompt()).toHaveAccessibleName("Zadání: SO4 2-");
    expect(prompt()).toHaveTextContent("SO₄²⁻");
    expect(screen.getByRole("textbox", { name: "Český název" })).toBeInTheDocument();
    answer("anion síranový");
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
  });

  it("does not count an empty answer", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    answer("   ");

    expect(screen.getByText("Napište český název.")).toBeInTheDocument();
    expect(screen.getByText("Špatně: 0")).toBeInTheDocument();
  });

  it("resumes an unfinished practice after a reload", async () => {
    renderPractice();
    fireEvent.click(await startButton());
    answer("chlorid stříbrný");
    await waitFor(async () =>
      expect(await createBrowserNomenclatureStore().load()).toMatchObject({
        currentId: sodiumChloride.id,
        correct: 1,
      }),
    );

    cleanup();
    renderPractice();

    expect(await screen.findByRole("heading", { name: "Zadání: NaCl" })).toBeInTheDocument();
    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    answer("chlorid sodný");
    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Zodpovězeno").nextElementSibling).toHaveTextContent("2 z 2");
  });

  it("ends a saved practice when the curriculum changed", async () => {
    renderPractice();
    fireEvent.click(await startButton());
    await waitFor(async () => expect(await createBrowserNomenclatureStore().load()).not.toBeNull());

    cleanup();
    renderPractice(undefined, "fixture-v2");

    expect(await screen.findByText(/Obsah cvičení se od posledního spuštění změnil/)).toBeVisible();
    expect(await startButton()).toBeEnabled();
    await waitFor(async () => expect(await createBrowserNomenclatureStore().load()).toBeNull());
  });

  it("discards a series saved by the earlier version and keeps the attempt history", async () => {
    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readwrite");
    transaction
      .objectStore(NOMENCLATURE_SESSION_STORE)
      .put({ id: "active", revision: 3, settings: {}, state: { status: "active" } });
    await transactionCompleted(transaction);
    database.close();

    renderPractice();

    expect(await screen.findByText(/ze starší verze cvičení byla ukončena/)).toBeVisible();
    expect(await startButton()).toBeEnabled();
    await waitFor(async () => expect(await createBrowserNomenclatureStore().load()).toBeNull());
  });

  it("offers a recoverable reset for a corrupt checkpoint", async () => {
    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readwrite");
    transaction.objectStore(NOMENCLATURE_SESSION_STORE).put({ id: "active", corrupted: true });
    await transactionCompleted(transaction);
    database.close();

    renderPractice();
    fireEvent.click(await screen.findByRole("button", { name: "Odstranit uložené cvičení" }));
    expect(await screen.findByText(/Historie pokusů zůstala zachována/)).toBeVisible();
  });

  it("stops on Ukončit, shows the summary, and returns to the filters", async () => {
    renderPractice();
    fireEvent.click(await startButton());
    answer("chlorid stříbrný");
    fireEvent.click(screen.getByRole("button", { name: "Ukončit" }));

    const summary = screen.getByRole("region", { name: "Vyhodnocení cvičení" });
    expect(within(summary).getByText("Zodpovězeno").nextElementSibling).toHaveTextContent("1 z 2");
    fireEvent.click(within(summary).getByRole("button", { name: "Změnit filtry" }));
    expect(await startButton()).toHaveTextContent("Spustit cvičení (2 sloučeniny)");
    await waitFor(async () => expect(await createBrowserNomenclatureStore().load()).toBeNull());
  });
});
