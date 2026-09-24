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
import { type AttemptEvent, createBrowserProgressStore } from "./browser-progress-store";
import { importLegacyData, keepLegacyOutsideAccount, legacyAttemptCount } from "./legacy-import";
import { pendingCount } from "./sync/sync-store";

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
