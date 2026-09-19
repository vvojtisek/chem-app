import { beforeEach, describe, expect, it } from "vitest";

import {
  createBrowserElementCardStore,
  type StoredElementCard,
} from "./browser-element-card-store";
import { LEARNING_DATABASE_NAME } from "./browser-learning-database";

const customCard: StoredElementCard = {
  id: "custom.bohrium-note",
  atomicNumber: 107,
  symbol: "Bh",
  nameCs: "Bohrium",
  nameLat: "Bohrium",
  period: 7,
  group: 7,
  atomicWeight: 270,
  valenceConfiguration: "6d5 7s2",
  kind: "custom",
  updatedAt: "2026-09-19T10:00:00.000Z",
};

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEARNING_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("BrowserElementCardStore", () => {
  it("persists a locally added card and validates it before storage", async () => {
    const store = createBrowserElementCardStore();
    await store.upsert(customCard);

    await expect(store.list()).resolves.toEqual([customCard]);
  });

  it("removes a local override without touching other records", async () => {
    const store = createBrowserElementCardStore();
    await store.upsert(customCard);
    await store.upsert({ ...customCard, id: "element.001-h", kind: "override" });

    await store.remove("element.001-h");

    await expect(store.list()).resolves.toEqual([customCard]);
  });
});
