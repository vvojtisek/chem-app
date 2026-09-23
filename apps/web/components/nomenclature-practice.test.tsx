import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NomenclatureRuntimeRecord } from "@inorganic/content/nomenclature-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  resetLearningDatabase,
  transactionCompleted,
} from "@/lib/browser-learning-database";
import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { NomenclaturePractice } from "./nomenclature-practice";

const chloride: NomenclatureRuntimeRecord = {
  id: "nomenclature.fixture-agcl",
  reviewLevel: "sme-reviewed",
  formula: "AgCl",
  nameCs: "chlorid stříbrný",
  explanationCs: "A reviewed fixture explanation.",
  baseCategory: "binary-salt",
  tags: [],
  difficulty: "basic",
  contextCs: null,
  directions: ["formula-to-name", "name-to-formula"],
  nameAliases: [],
  formulaAliases: [],
};

afterEach(cleanup);
beforeEach(async () => {
  await resetLearningDatabase(indexedDB);
});

function renderPractice(compounds: readonly NomenclatureRuntimeRecord[] = [chloride]) {
  return render(
    <NomenclaturePractice
      compounds={compounds}
      contentVersion="fixture-v1"
      elementSymbols={["Ag", "Cl", "H", "O"]}
    />,
  );
}

describe("NomenclaturePractice", () => {
  it("explains the review-gated empty state", async () => {
    renderPractice([]);
    expect(
      await screen.findByRole("heading", { name: /ověřené otázky zatím nejsou/i }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /začít cvičení/i })).not.toBeInTheDocument();
  });

  it("labels owner-approved curriculum honestly", async () => {
    renderPractice([{ ...chloride, reviewLevel: "owner-approved" }]);
    expect(await screen.findByText(/Vlastník projektu ji zkontroloval orientačně/)).toBeVisible();
  });

  it("offers a recoverable reset for a corrupt checkpoint", async () => {
    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readwrite");
    transaction.objectStore(NOMENCLATURE_SESSION_STORE).put({ id: "active", corrupted: true });
    await transactionCompleted(transaction);
    database.close();

    renderPractice();
    const reset = await screen.findByRole("button", { name: "Odstranit uloženou sérii" });
    fireEvent.click(reset);
    expect(await screen.findByText(/Historie pokusů zůstala zachována/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Začít cvičení" })).toBeVisible();
  });

  it("finishes a correct formula-to-name session and records its context", async () => {
    renderPractice();
    fireEvent.click(await screen.findByRole("button", { name: "Začít cvičení" }));
    expect(screen.queryByText("A reviewed fixture explanation.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Český název"), {
      target: { value: "  CHLORID   STŘÍBRNÝ " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("heading", { name: "Správně" })).toBeVisible();
    expect(screen.getByText(/A reviewed fixture explanation/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByRole("heading", { name: "Cvičení dokončeno" })).toBeVisible();
    await waitFor(async () => {
      const attempts = await createBrowserProgressStore().listAttempts();
      expect(attempts).toMatchObject([
        {
          mode: "nomenclature",
          direction: "formula-to-name",
          matchPolicy: "name-strict",
          isCorrect: true,
        },
      ]);
    });
  });

  it("retries one wrong answer and keeps initial accuracy separate", async () => {
    renderPractice();
    fireEvent.click(await screen.findByRole("button", { name: "Začít cvičení" }));
    fireEvent.change(screen.getByLabelText("Český název"), { target: { value: "chlorid zlatý" } });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("heading", { name: "Nesprávně" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText(/Opakování chyby/)).toBeVisible();
    expect(screen.queryByText("A reviewed fixture explanation.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Český název"), {
      target: { value: "chlorid stříbrný" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    fireEvent.click(screen.getByRole("button", { name: "Pokračovat" }));
    expect(screen.getByText(/Úspěšnost prvního průchodu: 0 %/)).toBeVisible();
    await waitFor(async () => {
      const attempts = await createBrowserProgressStore().listAttempts();
      expect(attempts.map((attempt) => attempt.round)).toEqual(["initial", "retry"]);
    });
  });

  it("previews and grades a formula answer without changing element case", async () => {
    renderPractice();
    fireEvent.click(await screen.findByLabelText("Název → vzorec"));
    fireEvent.click(screen.getByRole("button", { name: "Začít cvičení" }));
    fireEvent.change(screen.getByLabelText("Chemický vzorec"), { target: { value: "AgCl" } });
    expect(screen.getByText("Náhled vzorce:")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit" }));
    expect(screen.getByRole("heading", { name: "Správně" })).toBeVisible();
  });
});
