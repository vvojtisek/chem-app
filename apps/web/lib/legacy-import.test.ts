import { curatedElements, curriculumContentVersion } from "@inorganic/content/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ATTEMPT_EVENT_STORE,
  ELEMENT_CARD_STORE,
  LEARNING_DATABASE_NAME,
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  requestCompleted,
  resetLearningDatabase,
  transactionCompleted,
} from "./browser-learning-database";
import { createBrowserPeriodicSessionStore } from "./browser-periodic-session-store";
import { type AttemptEvent, createBrowserProgressStore } from "./browser-progress-store";
import { importLegacyData, keepLegacyOutsideAccount, legacyAttemptCount } from "./legacy-import";
import { createPeriodicCheckpoint, PERIODIC_NAME_SESSION_ID } from "./periodic-table-session";
import { createPracticeQueue } from "./practice-queue";
import { pendingCount, reconcileProgressGeneration } from "./sync/sync-store";

const user = "33333333-3333-4333-8333-333333333333";
const attempt: AttemptEvent = {
  id: "legacy.one",
  questionId: "element.h",
  contentVersion: "v1",
  occurredAt: "2026-09-23T10:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "element-name",
  direction: "symbol-to-name",
  matchPolicy: "diacritics-tolerant",
};

beforeEach(async () => {
  await resetLearningDatabase(indexedDB);
  await resetLearningDatabase(indexedDB, user);
});

async function seedLegacy() {
  const request = indexedDB.open(LEARNING_DATABASE_NAME, 4);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
    request.result.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    request.result.createObjectStore(NOMENCLATURE_SESSION_STORE, { keyPath: "id" });
  };
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = database.transaction(ATTEMPT_EVENT_STORE, "readwrite");
  tx.objectStore(ATTEMPT_EVENT_STORE).add(attempt);
  await transactionCompleted(tx);
  database.close();
}

async function seedLegacyLocalState() {
  const request = indexedDB.open(LEARNING_DATABASE_NAME);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(
    [ELEMENT_CARD_STORE, NOMENCLATURE_SESSION_STORE],
    "readwrite",
  );
  transaction.objectStore(ELEMENT_CARD_STORE).add({ id: "card.local", nameCs: "Lokální karta" });
  transaction.objectStore(NOMENCLATURE_SESSION_STORE).add({ id: "active", revision: 1 });
  await transactionCompleted(transaction);
  database.close();
}

describe("legacy import", () => {
  it("does not revive a prior generation through legacy import after reset", async () => {
    await seedLegacy();
    await reconcileProgressGeneration(indexedDB, user, "44444444-4444-4444-8444-444444444444");
    expect(await legacyAttemptCount(indexedDB, user)).toBeNull();
    await expect(importLegacyData(indexedDB, user)).rejects.toThrow("resetu pokroku");
    expect(await createBrowserProgressStore(indexedDB, user).listAttempts()).toEqual([]);
    expect(await createBrowserProgressStore(indexedDB).listAttempts()).toEqual([attempt]);
  });

  it("does not offer account import for a device-local periodic checkpoint alone", async () => {
    const elements = curatedElements.slice(0, 2);
    const session = createPracticeQueue(elements, () => 0.999_999);
    const checkpoint = createPeriodicCheckpoint(
      PERIODIC_NAME_SESSION_ID,
      session,
      new Set(elements.map((element) => element.id)),
      "name-to-symbol",
      curriculumContentVersion,
      1000,
      1,
    );
    if (!checkpoint) throw new Error("Expected running checkpoint.");
    const periodicStore = createBrowserPeriodicSessionStore(indexedDB);
    await periodicStore.write(PERIODIC_NAME_SESSION_ID, checkpoint, 0);

    expect(await legacyAttemptCount(indexedDB, user)).toBeNull();
    expect(await periodicStore.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
  });

  it("keeps an active periodic checkpoint on the device when old attempts are imported", async () => {
    await seedLegacy();
    const elements = curatedElements.slice(0, 2);
    const checkpoint = createPeriodicCheckpoint(
      PERIODIC_NAME_SESSION_ID,
      createPracticeQueue(elements, () => 0.999_999),
      new Set(elements.map((element) => element.id)),
      "name-to-symbol",
      curriculumContentVersion,
      1000,
      1,
    );
    if (!checkpoint) throw new Error("Expected running checkpoint.");
    const periodicStore = createBrowserPeriodicSessionStore(indexedDB);
    await periodicStore.write(PERIODIC_NAME_SESSION_ID, checkpoint, 0);

    expect(await legacyAttemptCount(indexedDB, user)).toBe(1);
    await importLegacyData(indexedDB, user);
    expect(await periodicStore.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
    expect(await createBrowserProgressStore(indexedDB, user).listAttempts()).toEqual([attempt]);
    expect(await createBrowserProgressStore(indexedDB).listAttempts()).toEqual([]);
    expect(await legacyAttemptCount(indexedDB, user)).toBeNull();
  });

  it("copies events into the chosen account and queues them before deleting legacy data", async () => {
    await seedLegacy();
    await seedLegacyLocalState();
    expect(await legacyAttemptCount(indexedDB, user)).toBe(1);
    await importLegacyData(indexedDB, user);
    expect(await createBrowserProgressStore(indexedDB, user).listAttempts()).toEqual([attempt]);
    expect(await pendingCount(indexedDB, user)).toBe(1);
    const database = await openLearningDatabase(indexedDB, user);
    const transaction = database.transaction(
      [ELEMENT_CARD_STORE, NOMENCLATURE_SESSION_STORE],
      "readonly",
    );
    const card = transaction.objectStore(ELEMENT_CARD_STORE).get("card.local");
    const checkpoint = transaction.objectStore(NOMENCLATURE_SESSION_STORE).get("active");
    expect(await Promise.all([requestCompleted(card), requestCompleted(checkpoint)])).toEqual([
      { id: "card.local", nameCs: "Lokální karta" },
      { id: "active", revision: 1 },
    ]);
    await transactionCompleted(transaction);
    database.close();
    expect((await indexedDB.databases()).some(({ name }) => name === LEARNING_DATABASE_NAME)).toBe(
      false,
    );
  });
  it("keeps old data outside the account after declining", async () => {
    await seedLegacy();
    await keepLegacyOutsideAccount(indexedDB, user);
    expect(await legacyAttemptCount(indexedDB, user)).toBeNull();
    expect((await indexedDB.databases()).some(({ name }) => name === LEARNING_DATABASE_NAME)).toBe(
      true,
    );
  });
});
