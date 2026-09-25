import { curatedElements, curriculumContentVersion } from "@inorganic/content/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ATTEMPT_EVENT_STORE,
  openLearningDatabase,
  PRACTICE_SESSION_STORE,
  requestCompleted,
  resetLearningDatabase,
  transactionCompleted,
} from "./browser-learning-database";
import {
  copyLegacyPeriodicCheckpoints,
  createBrowserPeriodicSessionStore,
} from "./browser-periodic-session-store";
import {
  createPeriodicCheckpoint,
  PERIODIC_NAME_SESSION_ID,
  PERIODIC_POSITION_SESSION_ID,
  restorePeriodicSession,
} from "./periodic-table-session";
import { answerPracticeQueue, createPracticeQueue } from "./practice-queue";
import { INITIAL_PROGRESS_GENERATION } from "./progress-generation";
import { reconcileProgressGeneration } from "./sync/sync-store";

const elements = curatedElements.slice(0, 3);
const byId = new Map(elements.map((element) => [element.id, element]));
const selected = new Set(elements.map((element) => element.id));
const store = createBrowserPeriodicSessionStore(indexedDB);

function initialCheckpoint() {
  const session = createPracticeQueue(elements, () => 0.999_999);
  const checkpoint = createPeriodicCheckpoint(
    PERIODIC_NAME_SESSION_ID,
    session,
    selected,
    "name-to-symbol",
    curriculumContentVersion,
    1500,
    1,
  );
  if (!checkpoint) throw new Error("Expected running checkpoint.");
  return { checkpoint, session };
}

beforeEach(async () => {
  await resetLearningDatabase(indexedDB);
});

describe("periodic-table checkpoint store", () => {
  it("copies a legacy device checkpoint once into the account and never restores it after reset", async () => {
    const userId = "88888888-8888-4888-8888-888888888888";
    await resetLearningDatabase(indexedDB, userId);
    const accountStore = createBrowserPeriodicSessionStore(indexedDB, userId);
    const { checkpoint } = initialCheckpoint();
    await store.write(PERIODIC_NAME_SESSION_ID, checkpoint, 0);
    await copyLegacyPeriodicCheckpoints(indexedDB, userId, INITIAL_PROGRESS_GENERATION);
    expect(await accountStore.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
    expect(await store.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
    const rotated = "99999999-9999-4999-8999-999999999999";
    await reconcileProgressGeneration(indexedDB, userId, rotated);
    await copyLegacyPeriodicCheckpoints(indexedDB, userId, rotated);
    expect(await accountStore.load(PERIODIC_NAME_SESSION_ID)).toBeNull();
    expect(await store.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
  });

  it("restores order, retry queue, score, and elapsed time without a new attempt", async () => {
    const { checkpoint, session } = initialCheckpoint();
    await store.write(PERIODIC_NAME_SESSION_ID, checkpoint, 0);

    const wrong = answerPracticeQueue(session, false);
    expect(wrong).not.toBeNull();
    if (!wrong) return;
    const updated = createPeriodicCheckpoint(
      PERIODIC_NAME_SESSION_ID,
      wrong.state,
      selected,
      "symbol-to-name",
      curriculumContentVersion,
      6800,
      2,
    );
    expect(updated).not.toBeNull();
    if (!updated) return;
    await store.write(PERIODIC_NAME_SESSION_ID, updated, 1);
    const loaded = await store.load(PERIODIC_NAME_SESSION_ID);
    expect(loaded).toEqual(updated);
    const resumed = restorePeriodicSession(updated, byId, curriculumContentVersion);
    expect(resumed.current?.id).toBe(wrong.state.current?.id);
    expect(resumed.queue.map((element) => element.id)).toEqual(
      wrong.state.queue.map((element) => element.id),
    );
    expect(resumed.missedIds).toEqual(wrong.state.missedIds);
    expect(resumed.incorrect).toBe(1);
    expect(updated.elapsedMs).toBe(6800);
    expect(await store.load(PERIODIC_POSITION_SESSION_ID)).toBeNull();
  });

  it("rejects stale tabs and leaves the newer checkpoint intact", async () => {
    const { checkpoint } = initialCheckpoint();
    await store.write(PERIODIC_NAME_SESSION_ID, checkpoint, 0);
    await expect(
      store.write(PERIODIC_NAME_SESSION_ID, { ...checkpoint, revision: 1 }, 0),
    ).rejects.toThrow("jiném okně");
    expect(await store.load(PERIODIC_NAME_SESSION_ID)).toEqual(checkpoint);
  });

  it("rejects corrupt and unsupported records and clears only the checkpoint", async () => {
    const { checkpoint } = initialCheckpoint();
    const database = await openLearningDatabase(indexedDB);
    const transaction = database.transaction(
      [PRACTICE_SESSION_STORE, ATTEMPT_EVENT_STORE],
      "readwrite",
    );
    transaction.objectStore(PRACTICE_SESSION_STORE).put({
      ...checkpoint,
      checkpointVersion: 99,
    });
    transaction.objectStore(ATTEMPT_EVENT_STORE).put({ id: "existing-attempt" });
    await transactionCompleted(transaction);
    database.close();

    await expect(store.load(PERIODIC_NAME_SESSION_ID)).rejects.toThrow();
    await store.clear(PERIODIC_NAME_SESSION_ID);
    expect(await store.load(PERIODIC_NAME_SESSION_ID)).toBeNull();

    const reopened = await openLearningDatabase(indexedDB);
    const read = reopened.transaction(ATTEMPT_EVENT_STORE, "readonly");
    expect(
      await requestCompleted(read.objectStore(ATTEMPT_EVENT_STORE).get("existing-attempt")),
    ).toEqual({
      id: "existing-attempt",
    });
    await transactionCompleted(read);
    reopened.close();
  });

  it("rejects a changed curriculum or missing element instead of exposing an answer", () => {
    const { checkpoint } = initialCheckpoint();
    expect(() => restorePeriodicSession(checkpoint, byId, "different-content")).toThrow(
      "jinou verzi",
    );
    expect(() => restorePeriodicSession(checkpoint, new Map(), curriculumContentVersion)).toThrow(
      "nedostupný prvek",
    );
    expect(() =>
      createPeriodicCheckpoint(
        PERIODIC_POSITION_SESSION_ID,
        createPracticeQueue(elements, () => 0.999_999),
        selected,
        "name-to-symbol",
        curriculumContentVersion,
        0,
        1,
      ),
    ).toThrow();
  });

  it("can resume after one of several missed questions has failed its final retry", () => {
    let state = createPracticeQueue(elements.slice(0, 2), () => 0.999_999);
    for (let index = 0; index < 3; index += 1) {
      const result = answerPracticeQueue(state, false);
      if (!result) throw new Error("Expected running practice.");
      state = result.state;
    }
    const checkpoint = createPeriodicCheckpoint(
      PERIODIC_POSITION_SESSION_ID,
      state,
      new Set(elements.slice(0, 2).map((element) => element.id)),
      "name-to-position",
      curriculumContentVersion,
      3000,
      1,
    );
    expect(checkpoint?.currentId).toBe(elements[1]?.id);
    expect(checkpoint?.incorrect).toBe(3);
    expect(
      checkpoint && restorePeriodicSession(checkpoint, byId, curriculumContentVersion).current?.id,
    ).toBe(elements[1]?.id);
  });
});
