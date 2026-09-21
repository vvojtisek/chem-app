import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTEMPT_EVENT_STORE,
  ELEMENT_CARD_STORE,
  LEARNING_DATABASE_NAME,
  LEARNING_DATABASE_VERSION,
  openLearningDatabase,
  resetLearningDatabase,
} from "./browser-learning-database";

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
});

function openDatabaseAtVersion(version: number): Promise<IDBDatabase> {
  const request = indexedDB.open(LEARNING_DATABASE_NAME, version);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
