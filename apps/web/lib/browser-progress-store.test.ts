import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTEMPT_EVENT_STORE,
  openLearningDatabase,
  transactionCompleted,
} from "./browser-learning-database";
import {
  type AttemptEvent,
  createBrowserProgressStore,
  PROGRESS_DATABASE_NAME,
} from "./browser-progress-store";

const earlierAttempt: AttemptEvent = {
  id: "attempt.001",
  questionId: "element.hydrogen",
  contentVersion: "2026-09-19",
  occurredAt: "2026-09-19T08:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "element-name",
  direction: "symbol-to-name",
  matchPolicy: "diacritics-tolerant",
};

const laterAttempt: AttemptEvent = {
  id: "attempt.002",
  questionId: "element.helium",
  contentVersion: "2026-09-19",
  occurredAt: "2026-09-19T09:00:00.000Z",
  isCorrect: false,
  round: "retry",
  mode: "element-name",
  direction: "symbol-to-name",
  matchPolicy: "diacritics-tolerant",
};

const periodicTableAttempt: AttemptEvent = {
  id: "attempt.003",
  questionId: "element.lithium",
  contentVersion: "2026-09-21",
  occurredAt: "2026-09-19T10:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "periodic-table",
  direction: "name-to-position",
  matchPolicy: "exact-position",
};

const reversePeriodicTableAttempt: AttemptEvent = {
  id: "attempt.004",
  questionId: "element.hydrogen",
  contentVersion: "2026-09-21",
  occurredAt: "2026-09-19T11:00:00.000Z",
  isCorrect: true,
  round: "retry",
  mode: "periodic-table",
  direction: "position-to-name",
  matchPolicy: "diacritics-tolerant",
};

const nameOrSymbolAttempt: AttemptEvent = {
  id: "attempt.005",
  questionId: "element.011-na",
  contentVersion: "2026-09-23",
  occurredAt: "2026-09-23T08:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "periodic-table",
  direction: "position-to-name-or-symbol",
  matchPolicy: "name-tolerant-or-symbol-exact",
};

const nameToSymbolAttempt: AttemptEvent = {
  id: "attempt.006",
  questionId: "element.011-na",
  contentVersion: "2026-09-23",
  occurredAt: "2026-09-23T09:00:00.000Z",
  isCorrect: false,
  round: "initial",
  mode: "periodic-table",
  direction: "name-to-symbol",
  matchPolicy: "symbol-exact",
};

const symbolToNameAttempt: AttemptEvent = {
  id: "attempt.007",
  questionId: "element.011-na",
  contentVersion: "2026-09-23",
  occurredAt: "2026-09-23T09:01:00.000Z",
  isCorrect: true,
  round: "retry",
  mode: "periodic-table",
  direction: "symbol-to-name",
  matchPolicy: "diacritics-tolerant",
};

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PROGRESS_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("BrowserProgressStore", () => {
  it("persists and retrieves immutable attempt events in chronological order", async () => {
    const store = createBrowserProgressStore();

    await store.appendAttempt(laterAttempt);
    await store.appendAttempt(earlierAttempt);
    await store.appendAttempt(periodicTableAttempt);
    await store.appendAttempt(reversePeriodicTableAttempt);

    await expect(store.listAttempts()).resolves.toEqual([
      earlierAttempt,
      laterAttempt,
      periodicTableAttempt,
      reversePeriodicTableAttempt,
    ]);
  });

  it("clears only the application's attempt event store", async () => {
    const store = createBrowserProgressStore();
    await store.appendAttempt(earlierAttempt);

    await store.clearAttempts();

    await expect(store.listAttempts()).resolves.toEqual([]);
  });

  it("ignores stored records with an unknown learning context or timestamp", async () => {
    const store = createBrowserProgressStore();
    await store.appendAttempt(earlierAttempt);

    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(ATTEMPT_EVENT_STORE, "readwrite");
    const attempts = transaction.objectStore(ATTEMPT_EVENT_STORE);
    attempts.add({ ...laterAttempt, id: "attempt.mixed", direction: "name-to-position" });
    attempts.add({ ...laterAttempt, id: "attempt.unknown", mode: "nomenclature" });
    attempts.add({ ...laterAttempt, id: "attempt.time", occurredAt: "yesterday" });
    attempts.add({ ...laterAttempt, id: "attempt.round", round: "second" });
    await transactionCompleted(transaction);
    database.close();

    await expect(store.listAttempts()).resolves.toEqual([earlierAttempt]);
  });

  it("rejects an attempt whose mode, direction, and policy do not belong together", async () => {
    const store = createBrowserProgressStore();

    await expect(
      store.appendAttempt({ ...periodicTableAttempt, matchPolicy: "diacritics-tolerant" }),
    ).rejects.toThrow("Pokus má neplatný kontext procvičování.");
    await expect(store.listAttempts()).resolves.toEqual([]);
  });

  it("keeps name-or-symbol attempts distinct from earlier name-only attempts", async () => {
    const store = createBrowserProgressStore();

    await store.appendAttempt(reversePeriodicTableAttempt);
    await store.appendAttempt(nameOrSymbolAttempt);

    await expect(store.listAttempts()).resolves.toEqual([
      reversePeriodicTableAttempt,
      nameOrSymbolAttempt,
    ]);
    await expect(
      store.appendAttempt({
        ...nameOrSymbolAttempt,
        id: "attempt.mislabelled",
        matchPolicy: "diacritics-tolerant",
      }),
    ).rejects.toThrow();
    await expect(
      store.appendAttempt({
        ...reversePeriodicTableAttempt,
        id: "attempt.mislabelled-old",
        matchPolicy: "name-tolerant-or-symbol-exact",
      }),
    ).rejects.toThrow();
  });

  it("stores the typed name-to-symbol and symbol-to-name contexts with their own policies", async () => {
    const store = createBrowserProgressStore();

    await store.appendAttempt(nameOrSymbolAttempt);
    await store.appendAttempt(nameToSymbolAttempt);
    await store.appendAttempt(symbolToNameAttempt);

    await expect(store.listAttempts()).resolves.toEqual([
      nameOrSymbolAttempt,
      nameToSymbolAttempt,
      symbolToNameAttempt,
    ]);
    for (const mislabelled of [
      { ...nameToSymbolAttempt, matchPolicy: "name-tolerant-or-symbol-exact" },
      { ...nameToSymbolAttempt, matchPolicy: "diacritics-tolerant" },
      { ...symbolToNameAttempt, matchPolicy: "symbol-exact" },
      { ...periodicTableAttempt, matchPolicy: "symbol-exact" },
    ] as const) {
      await expect(
        store.appendAttempt({ ...mislabelled, id: `${mislabelled.id}.mislabelled` }),
      ).rejects.toThrow("Pokus má neplatný kontext procvičování.");
    }
  });
});
