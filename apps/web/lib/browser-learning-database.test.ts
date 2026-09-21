import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTEMPT_EVENT_STORE,
  ELEMENT_CARD_STORE,
  LEARNING_DATABASE_NAME,
  LEARNING_DATABASE_VERSION,
  openLearningDatabase,
  resetLearningDatabase,
} from "./browser-learning-database";

const legacyAttempt = {
  id: "attempt.legacy",
  questionId: "element.001-h",
  contentVersion: "elements-2026-09-19",
  occurredAt: "2026-09-19T08:00:00.000Z",
  isCorrect: true,
};

beforeEach(async () => {
  await resetLearningDatabase(indexedDB);
});

describe("Learning database", () => {
  it("resets an unsupported newer local database before reopening it", async () => {
    const newerDatabase = await openDatabaseAtVersion(LEARNING_DATABASE_VERSION + 1);
    newerDatabase.close();

    const recoveredDatabase = await openLearningDatabase(indexedDB);

    expect(recoveredDatabase.version).toBe(LEARNING_DATABASE_VERSION);
    expect(recoveredDatabase.objectStoreNames.contains(ATTEMPT_EVENT_STORE)).toBe(true);
    expect(recoveredDatabase.objectStoreNames.contains(ELEMENT_CARD_STORE)).toBe(true);

    recoveredDatabase.close();
  });

  it("reports a blocked reset instead of waiting indefinitely", async () => {
    const database = await openLearningDatabase(indexedDB);

    await expect(resetLearningDatabase(indexedDB)).rejects.toThrow(
      "protože je aplikace otevřená v jiném okně",
    );

    database.close();
  });

  it("migrates version-two attempt events without losing their history", async () => {
    const legacyDatabase = await openDatabaseAtVersion(2, (database) => {
      database.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
      database.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    });
    const transaction = legacyDatabase.transaction(ATTEMPT_EVENT_STORE, "readwrite");
    transaction.objectStore(ATTEMPT_EVENT_STORE).add(legacyAttempt);
    await transactionComplete(transaction);
    legacyDatabase.close();

    const migratedDatabase = await openLearningDatabase(indexedDB);
    const migratedTransaction = migratedDatabase.transaction(ATTEMPT_EVENT_STORE, "readonly");
    const migratedValues = await requestComplete<unknown[]>(
      migratedTransaction.objectStore(ATTEMPT_EVENT_STORE).getAll(),
    );
    await transactionComplete(migratedTransaction);
    migratedDatabase.close();

    expect(migratedValues).toEqual([
      {
        ...legacyAttempt,
        round: "initial",
        mode: "element-name",
        direction: "symbol-to-name",
        matchPolicy: "diacritics-tolerant",
      },
    ]);
  });
});

function openDatabaseAtVersion(
  version: number,
  upgrade?: (database: IDBDatabase) => void,
): Promise<IDBDatabase> {
  const request = indexedDB.open(LEARNING_DATABASE_NAME, version);

  return new Promise((resolve, reject) => {
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestComplete<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
