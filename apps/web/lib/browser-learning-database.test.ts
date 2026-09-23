import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTEMPT_EVENT_STORE,
  ELEMENT_CARD_STORE,
  NOMENCLATURE_SESSION_STORE,
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
  it("preserves an unsupported newer local database", async () => {
    const newerDatabase = await openDatabaseAtVersion(LEARNING_DATABASE_VERSION + 1);
    newerDatabase.close();
    await expect(openLearningDatabase(indexedDB)).rejects.toThrow("data nebyla smazána");
    const stillNewer = await openDatabaseAtVersion(LEARNING_DATABASE_VERSION + 1);
    expect(stillNewer.version).toBe(LEARNING_DATABASE_VERSION + 1);
    stillNewer.close();
  });

  it("closes an open connection when another tab resets the database", async () => {
    const database = await openLearningDatabase(indexedDB);

    await expect(resetLearningDatabase(indexedDB)).resolves.toBeUndefined();

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
    expect(migratedDatabase.objectStoreNames.contains(NOMENCLATURE_SESSION_STORE)).toBe(true);
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

  it("upgrades version three while preserving attempts and local cards", async () => {
    const old = await openDatabaseAtVersion(3, (database) => {
      database.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
      database.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    });
    const transaction = old.transaction([ATTEMPT_EVENT_STORE, ELEMENT_CARD_STORE], "readwrite");
    transaction.objectStore(ATTEMPT_EVENT_STORE).add({
      ...legacyAttempt,
      round: "initial",
      mode: "element-name",
      direction: "symbol-to-name",
      matchPolicy: "diacritics-tolerant",
    });
    transaction.objectStore(ELEMENT_CARD_STORE).add({ id: "card.test", nameCs: "Lokální karta" });
    await transactionComplete(transaction);
    old.close();

    const upgraded = await openLearningDatabase(indexedDB);
    expect(upgraded.version).toBe(4);
    expect(upgraded.objectStoreNames.contains(NOMENCLATURE_SESSION_STORE)).toBe(true);
    const read = upgraded.transaction([ATTEMPT_EVENT_STORE, ELEMENT_CARD_STORE], "readonly");
    expect(
      await requestComplete(read.objectStore(ATTEMPT_EVENT_STORE).get("attempt.legacy")),
    ).toBeDefined();
    expect(
      await requestComplete(read.objectStore(ELEMENT_CARD_STORE).get("card.test")),
    ).toMatchObject({ nameCs: "Lokální karta" });
    await transactionComplete(read);
    upgraded.close();
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
