import { beforeEach, describe, expect, it } from "vitest";

import {
  createBrowserProgressStore,
  PROGRESS_DATABASE_NAME,
  type AttemptEvent,
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

    await expect(store.listAttempts()).resolves.toEqual([
      earlierAttempt,
      laterAttempt,
      periodicTableAttempt,
    ]);
  });

  it("clears only the application's attempt event store", async () => {
    const store = createBrowserProgressStore();
    await store.appendAttempt(earlierAttempt);

    await store.clearAttempts();

    await expect(store.listAttempts()).resolves.toEqual([]);
  });
});
