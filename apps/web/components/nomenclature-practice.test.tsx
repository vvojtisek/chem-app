import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  resetLearningDatabase,
  transactionCompleted,
} from "@/lib/browser-learning-database";
import { createBrowserNomenclatureStore } from "@/lib/browser-nomenclature-store";
import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import {
  NOMENCLATURE_FILTERS_KEY,
  saveNomenclatureDirection,
} from "@/lib/nomenclature-preferences";
import { DEFAULT_NOMENCLATURE_FILTERS } from "@/lib/nomenclature-session";
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
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

function scripts(element: HTMLElement, tag: "sub" | "sup"): string[] {
  return [...element.querySelectorAll(tag)].map((node) => node.textContent ?? "");
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

  it("starts a session when randomUUID is unavailable on an HTTP LAN origin", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      },
    });
    renderPractice();

    fireEvent.click(await startButton());

    expect(prompt()).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
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
  it("keeps the final incorrect retry and its explanation visible until results are requested", async () => {
    renderPractice([silverChloride]);
    fireEvent.click(await startButton());
    answer("chybná odpověď");
    answer("znovu chybná odpověď");
    const review = screen.getByRole("region", { name: "Poslední odpověď" });
    expect(within(review).getByText("Špatně", { exact: true })).toBeVisible();
    expect(within(review).getByText("Fixture explanation.")).toBeVisible();
    expect(within(review).getByRole("img", { name: "AgCl" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    const button = within(review).getByRole("button", { name: "Zobrazit výsledky" });
    expect(button).toHaveFocus();
    await waitFor(async () =>
      expect(await createBrowserProgressStore().listAttempts()).toHaveLength(2),
    );
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: "Vyhodnocení cvičení" })).toBeVisible();
    expect(await createBrowserProgressStore().listAttempts()).toHaveLength(2);
  });
  it("asks directly with a focused input, accepts a lenient name, and records the attempt", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    expect(prompt()).toHaveAccessibleName("Zadání: AgCl");
    expect(screen.getByRole("textbox", { name: "Český název" })).toHaveFocus();
    expect(screen.getByText("Správně: 0")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");

    answer("  CHLORID   stribrny ");

    expect(screen.getByText("Správně: 1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Postup cvičením" })).toHaveAttribute(
      "aria-valuetext",
      "1 z 2",
    );
    expect(prompt()).toHaveAccessibleName("Zadání: NaCl");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("Uznáno. Přesný zápis: chlorid stříbrný.")).toBeInTheDocument();
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
    expect(prompt()).toHaveTextContent("MgCl2·6H2O");
    expect(scripts(prompt(), "sub")).toEqual(["2", "2"]);

    answer("hexahydratchloriduhorecnateho");

    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeInTheDocument();
  });

  it("shows the correct answer and explanation after a mistake and asks the item again", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    answer("chlorid sodný");

    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.getByText("Špatně", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Vaše odpověď:").parentElement).toHaveTextContent(
      "Vaše odpověď: chlorid sodný",
    );
    expect(screen.getByRole("img", { name: "AgCl" })).toBeInTheDocument();
    expect(screen.getByText("chlorid stříbrný")).toBeInTheDocument();
    expect(screen.getByText("Fixture explanation.")).toBeInTheDocument();
    expect(prompt()).toHaveAccessibleName("Zadání: NaCl");

    answer("chlorid sodný");
    expect(prompt()).toHaveAccessibleName("Zadání: AgCl");
    answer("chlorid stříbrný");

    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
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

  it("records Nevím as incorrect, shows the comparison, and centers the prompt", async () => {
    renderPractice();
    fireEvent.click(await startButton());

    expect(prompt()).toHaveClass("text-center");
    fireEvent.click(screen.getByRole("button", { name: "Nevím" }));

    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.getByText("Vaše odpověď:").parentElement).toHaveTextContent(
      "Vaše odpověď: Nevím",
    );
    expect(screen.getByRole("img", { name: "AgCl" })).toBeInTheDocument();
    await waitFor(async () =>
      expect((await createBrowserProgressStore().listAttempts()).at(-1)).toMatchObject({
        compoundId: silverChloride.id,
        isCorrect: false,
        outcome: "incorrect",
      }),
    );
  });

  it("locks name-to-formula across the full compatible queue, mistakes, retries and reloads", async () => {
    renderPractice([sodiumChloride, sulfate, silverChloride]);
    fireEvent.click(await startButton());
    fireEvent.click(screen.getByRole("radio", { name: "Název → Vzorec" }));
    expect(prompt()).toHaveAccessibleName("Zadání: chlorid sodný");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 z 2");
    answer("nacl");
    expect(screen.getByText("Špatně: 1")).toBeVisible();
    expect(prompt()).toHaveAccessibleName("Zadání: chlorid stříbrný");
    expect(screen.getByRole("textbox", { name: "Chemický vzorec" })).toBeVisible();
    await waitFor(async () =>
      expect(await createBrowserNomenclatureStore().load()).toMatchObject({
        direction: "name-to-formula",
        currentId: silverChloride.id,
      }),
    );
    cleanup();
    saveNomenclatureDirection("formula-to-name");
    renderPractice([sodiumChloride, sulfate, silverChloride]);
    expect(await screen.findByRole("heading", { name: "Zadání: chlorid stříbrný" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Název → Vzorec" })).toBeChecked();
    answer("AgCl");
    expect(prompt()).toHaveAccessibleName("Zadání: chlorid sodný");
    answer("NaCl");
    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeVisible();
    await waitFor(async () =>
      expect(
        (await createBrowserProgressStore().listAttempts()).map((event) => event.direction),
      ).toEqual(["name-to-formula", "name-to-formula", "name-to-formula"]),
    );
  });

  it("allows choosing the direction before starting and counts only supported compounds", async () => {
    renderPractice([sodiumChloride, sulfate, silverChloride]);
    await startButton();
    fireEvent.click(screen.getByRole("radio", { name: "Název → Vzorec" }));
    expect(await startButton()).toHaveTextContent("2 sloučeniny");
    fireEvent.click(await startButton());
    answer("NaCl");
    expect(prompt()).toHaveAccessibleName("Zadání: chlorid stříbrný");
    answer("AgCl");
    expect(screen.getByText("Správně: 2")).toBeVisible();
  });

  it("changes direction only on an explicit toggle and handles a direction with no supported questions", async () => {
    renderPractice([sulfate]);
    fireEvent.click(await startButton());
    expect(prompt()).toHaveAccessibleName("Zadání: SO4 2-");
    fireEvent.click(screen.getByRole("radio", { name: "Název → Vzorec" }));
    expect(await startButton()).toBeDisabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Vzorec → Název" }));
    fireEvent.click(await startButton());
    expect(prompt()).toHaveAccessibleName("Zadání: SO4 2-");
  });

  it("repairs a v2 checkpoint without direction instead of asking an unsupported question", async () => {
    saveNomenclatureDirection("name-to-formula");
    await createBrowserNomenclatureStore().write(
      {
        id: "active",
        checkpointVersion: 2,
        revision: 1,
        sessionId: "legacy-direction",
        contentVersion: "fixture-v1",
        filters: DEFAULT_NOMENCLATURE_FILTERS,
        currentId: sulfate.id,
        queueIds: [sodiumChloride.id],
        solvedIds: [],
        missedIds: [],
        correct: 0,
        incorrect: 0,
        total: 2,
        sequence: 0,
        elapsedMs: 0,
      },
      0,
    );
    renderPractice([sulfate, sodiumChloride]);
    expect(await screen.findByRole("heading", { name: "Zadání: chlorid sodný" })).toBeVisible();
    expect(screen.getByText(/nepodporující uložený směr/)).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 z 1");
    answer("NaCl");
    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
    expect(screen.getByRole("heading", { name: "Vyhodnocení cvičení" })).toBeVisible();
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
    expect(screen.queryByRole("region", { name: "Vyhodnocení cvičení" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit výsledky" }));
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
