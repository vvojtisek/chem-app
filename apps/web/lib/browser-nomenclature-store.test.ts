import { beforeEach, describe, expect, it } from "vitest";
import {
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  resetLearningDatabase,
  transactionCompleted,
} from "./browser-learning-database";
import {
  createBrowserNomenclatureStore,
  LegacyNomenclatureCheckpointError,
} from "./browser-nomenclature-store";
import {
  createBrowserProgressStore,
  type NomenclatureAttemptEvent,
} from "./browser-progress-store";
import { DEFAULT_NOMENCLATURE_FILTERS, type NomenclatureCheckpoint } from "./nomenclature-session";

const checkpoint: NomenclatureCheckpoint = {
  id: "active",
  checkpointVersion: 2,
  revision: 1,
  sessionId: "session.fixture",
  contentVersion: "fixture-v1",
  filters: DEFAULT_NOMENCLATURE_FILTERS,
  currentId: "nomenclature.fixture-agcl",
  queueIds: ["nomenclature.fixture-nacl"],
  solvedIds: [],
  missedIds: [],
  correct: 0,
  incorrect: 0,
  total: 2,
  sequence: 1,
  elapsedMs: 4_000,
};

const attempt: NomenclatureAttemptEvent = {
  id: "session.fixture:0",
  eventSchemaVersion: 1,
  sessionId: "session.fixture",
  sequence: 0,
  questionId: "nomenclature.fixture-agcl.formula-to-name",
  compoundId: "nomenclature.fixture-agcl",
  contentVersion: "fixture-v1",
  occurredAt: "2026-09-22T12:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "nomenclature",
  outcome: "correct",
  match: "canonical",
  direction: "formula-to-name",
  matchPolicy: "name-lenient",
};

beforeEach(async () => {
  await resetLearningDatabase(indexedDB);
});

describe("nomenclature checkpoint and attempts", () => {
  it("commits an attempt and pinned session together, then replays an identical event once", async () => {
    const store = createBrowserNomenclatureStore();
    await store.write(checkpoint, 0, [attempt]);
    expect(await store.load()).toEqual(checkpoint);
    expect(await createBrowserProgressStore().listAttempts()).toEqual([attempt]);

    await store.write({ ...checkpoint, revision: 2 }, 1, [attempt]);
    expect(await createBrowserProgressStore().listAttempts()).toEqual([attempt]);
  });

  it("rejects conflicting attempts and stale tabs without advancing the session", async () => {
    const store = createBrowserNomenclatureStore();
    await store.write(checkpoint, 0, [attempt]);
    await expect(
      store.write({ ...checkpoint, revision: 2 }, 1, [
        { ...attempt, isCorrect: false, outcome: "incorrect" },
      ]),
    ).rejects.toThrow("stejným ID");
    await expect(store.write({ ...checkpoint, revision: 2 }, 0)).rejects.toThrow();
    expect((await store.load())?.revision).toBe(1);
    expect(await createBrowserProgressStore().listAttempts()).toEqual([attempt]);
  });

  it("clears a session without deleting historical attempts", async () => {
    const store = createBrowserNomenclatureStore();
    await store.write(checkpoint, 0, [attempt]);
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(await createBrowserProgressStore().listAttempts()).toEqual([attempt]);
  });

  it("removes the checkpoint together with the final attempt of a finished practice", async () => {
    const store = createBrowserNomenclatureStore();
    await store.write(checkpoint, 0);
    await store.write(null, 1, [attempt]);
    expect(await store.load()).toBeNull();
    expect(await createBrowserProgressStore().listAttempts()).toEqual([attempt]);
  });

  it("reports a series stored by the earlier version so it can be discarded", async () => {
    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readwrite");
    transaction.objectStore(NOMENCLATURE_SESSION_STORE).put({
      id: "active",
      revision: 7,
      settings: { direction: "formula-to-name" },
      state: { status: "active" },
    });
    await transactionCompleted(transaction);
    database.close();

    const store = createBrowserNomenclatureStore();
    await expect(store.load()).rejects.toBeInstanceOf(LegacyNomenclatureCheckpointError);
    await store.write(null, 0);
    expect(await store.load()).toBeNull();
  });
});
