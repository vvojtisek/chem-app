import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appendAttempt = vi.hoisted(() => vi.fn());
vi.mock("@/lib/periodic-table-attempts", () => ({
  appendPeriodicTableAttempt: appendAttempt,
  describeAttemptSaveFailure: () => "Pokus se nepodařilo uložit.",
}));

import {
  ATTEMPT_EVENT_STORE,
  openLearningDatabase,
  PRACTICE_SESSION_STORE,
  requestCompleted,
  resetLearningDatabase,
  transactionCompleted,
} from "@/lib/browser-learning-database";
import { createBrowserPeriodicSessionStore } from "@/lib/browser-periodic-session-store";
import {
  PERIODIC_NAME_SESSION_ID,
  PERIODIC_POSITION_SESSION_ID,
} from "@/lib/periodic-table-session";
import { PeriodicTableNamePractice } from "./periodic-table-name-practice";
import { PeriodicTablePractice } from "./periodic-table-practice";

const elements: readonly ElementFlashcardData[] = [
  {
    id: "element.001-h",
    atomicNumber: 1,
    symbol: "H",
    nameCs: "Vodík",
    nameLat: "Hydrogenium",
    period: 1,
    group: 1,
    atomicWeight: 1.008,
    valenceConfiguration: "1s1",
  },
  {
    id: "element.002-he",
    atomicNumber: 2,
    symbol: "He",
    nameCs: "Helium",
    nameLat: "Helium",
    period: 1,
    group: 18,
    atomicWeight: 4.0026,
    valenceConfiguration: "1s2",
  },
];
const store = createBrowserPeriodicSessionStore(indexedDB);
const keepOrder = () => 0.999_999;

beforeEach(async () => {
  window.localStorage.clear();
  appendAttempt.mockReset();
  appendAttempt.mockResolvedValue(undefined);
  await resetLearningDatabase(indexedDB);
});

afterEach(() => cleanup());

describe("periodic-table reload recovery", () => {
  it("offers a safe discard for an unsupported checkpoint and retains attempt history", async () => {
    const database = await openLearningDatabase(indexedDB);
    const write = database.transaction([PRACTICE_SESSION_STORE, ATTEMPT_EVENT_STORE], "readwrite");
    write.objectStore(PRACTICE_SESSION_STORE).put({
      id: PERIODIC_NAME_SESSION_ID,
      checkpointVersion: 99,
    });
    write.objectStore(ATTEMPT_EVENT_STORE).put({ id: "earlier-attempt" });
    await transactionCompleted(write);
    database.close();

    render(<PeriodicTableNamePractice elements={elements} random={keepOrder} />);
    expect(await screen.findByText(/nelze načíst/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Přejít na cvičení/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Odstranit uložené cvičení" }));
    expect(await screen.findByRole("button", { name: /Přejít na cvičení/ })).toBeInTheDocument();
    expect(await store.load(PERIODIC_NAME_SESSION_ID)).toBeNull();

    const reopened = await openLearningDatabase(indexedDB);
    const read = reopened.transaction(ATTEMPT_EVENT_STORE, "readonly");
    expect(
      await requestCompleted(read.objectStore(ATTEMPT_EVENT_STORE).get("earlier-attempt")),
    ).toEqual({
      id: "earlier-attempt",
    });
    await transactionCompleted(read);
    reopened.close();
  });

  it("resumes name practice with its mode and retry, without replaying an attempt or answer", async () => {
    render(<PeriodicTableNamePractice elements={elements} random={keepOrder} />);
    fireEvent.click(await screen.findByRole("button", { name: /Přejít na cvičení/ }));
    const input = screen.getByRole("textbox", { name: "Značka prvku" });
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.submit(input.closest("form") ?? input);
    fireEvent.click(screen.getByRole("radio", { name: "Značka → Název" }));

    await waitFor(async () => {
      const saved = await store.load(PERIODIC_NAME_SESSION_ID);
      expect(saved?.currentId).toBe(elements[1]?.id);
      expect(saved?.queueIds).toEqual([elements[0]?.id]);
      expect(saved?.incorrect).toBe(1);
      expect(saved?.mode).toBe("symbol-to-name");
    });
    expect(appendAttempt).toHaveBeenCalledTimes(1);

    cleanup();
    render(<PeriodicTableNamePractice elements={elements} random={keepOrder} />);
    await screen.findByRole("heading", { name: "Zadání: He" });
    expect(screen.getByRole("radio", { name: "Značka → Název" })).toBeChecked();
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(screen.queryByText("Špatně: Vodík (H).")).toBeNull();
    expect(appendAttempt).toHaveBeenCalledTimes(1);

    const restoredInput = screen.getByRole("textbox", { name: "Český název prvku" });
    fireEvent.change(restoredInput, { target: { value: "Helium" } });
    fireEvent.submit(restoredInput.closest("form") ?? restoredInput);
    fireEvent.change(restoredInput, { target: { value: "Vodík" } });
    fireEvent.submit(restoredInput.closest("form") ?? restoredInput);
    await waitFor(async () => expect(await store.load(PERIODIC_NAME_SESSION_ID)).toBeNull());
    expect(screen.getByRole("region", { name: "Vyhodnocení cvičení" })).toHaveTextContent("2 z 2");
    expect(appendAttempt).toHaveBeenCalledTimes(3);
  });

  it("resumes the blind table with solved cells and its retry queue", async () => {
    render(<PeriodicTablePractice elements={elements} random={keepOrder} />);
    fireEvent.click(await screen.findByRole("button", { name: /Přejít na cvičení/ }));
    const table = screen.getByRole("region", { name: "Periodická tabulka" });
    fireEvent.click(within(table).getByRole("button", { name: "Perioda 1, skupina 18" }));
    await waitFor(async () => {
      const saved = await store.load(PERIODIC_POSITION_SESSION_ID);
      expect(saved?.currentId).toBe(elements[1]?.id);
      expect(saved?.queueIds).toEqual([elements[0]?.id]);
      expect(saved?.incorrect).toBe(1);
    });
    cleanup();
    render(<PeriodicTablePractice elements={elements} random={keepOrder} />);
    await screen.findByRole("heading", { name: "Hledaný prvek: Helium" });
    expect(screen.getByText("Špatně: 1")).toBeInTheDocument();
    expect(appendAttempt).toHaveBeenCalledTimes(1);
    const restoredTable = screen.getByRole("region", { name: "Periodická tabulka" });
    fireEvent.click(within(restoredTable).getByRole("button", { name: "Perioda 1, skupina 18" }));
    fireEvent.click(within(restoredTable).getByRole("button", { name: "Perioda 1, skupina 1" }));
    await waitFor(async () => expect(await store.load(PERIODIC_POSITION_SESSION_ID)).toBeNull());
    expect(screen.getByRole("region", { name: "Vyhodnocení cvičení" })).toHaveTextContent("2 z 2");
    expect(appendAttempt).toHaveBeenCalledTimes(3);
  });
});
