import { beforeEach, describe, expect, it } from "vitest";
import {
  ELEMENT_CARD_STORE,
  openLearningDatabase,
  PRACTICE_SESSION_STORE,
  requestCompleted,
  resetLearningDatabase,
  transactionCompleted,
} from "../browser-learning-database";
import { type AttemptEvent, createBrowserProgressStore } from "../browser-progress-store";
import { INITIAL_PROGRESS_GENERATION } from "../progress-generation";
import {
  acknowledgeAttempts,
  pendingAttempts,
  pendingCount,
  reconcileProgressGeneration,
  savePulledAttempts,
} from "./sync-store";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const event: AttemptEvent = {
  id: "attempt.one",
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
  await resetLearningDatabase(indexedDB, userA);
  await resetLearningDatabase(indexedDB, userB);
});

describe("account sync store", () => {
  it("commits attempts and their outbox entry together, isolated by account", async () => {
    await createBrowserProgressStore(indexedDB, userA).appendAttempt(event);
    expect(await pendingAttempts(indexedDB, userA)).toEqual([event]);
    expect(await pendingCount(indexedDB, userB)).toBe(0);
    await expect(
      createBrowserProgressStore(indexedDB, userA).appendAttempt(event),
    ).rejects.toThrow();
    expect(await pendingCount(indexedDB, userA)).toBe(1);
    await acknowledgeAttempts(indexedDB, userA, [event.id]);
    expect(await pendingCount(indexedDB, userA)).toBe(0);
    expect(await createBrowserProgressStore(indexedDB, userA).listAttempts()).toEqual([event]);
  });

  it("stores pulled events without placing them in the outbox", async () => {
    await savePulledAttempts(indexedDB, userB, [event], "cursor-1");
    expect(await pendingCount(indexedDB, userB)).toBe(0);
    expect(await createBrowserProgressStore(indexedDB, userB).listAttempts()).toEqual([event]);
  });

  it("clears only one account's progress while retaining cards and rejecting stale in-memory events", async () => {
    const newGeneration = "33333333-3333-4333-8333-333333333333";
    await createBrowserProgressStore(indexedDB, userA).appendAttempt(event);
    await createBrowserProgressStore(indexedDB, userB).appendAttempt(event);
    const database = await openLearningDatabase(indexedDB, userA);
    const write = database.transaction([ELEMENT_CARD_STORE, PRACTICE_SESSION_STORE], "readwrite");
    write.objectStore(ELEMENT_CARD_STORE).put({ id: "own-card", kind: "custom" });
    write.objectStore(PRACTICE_SESSION_STORE).put({ id: "active", checkpointVersion: 2 });
    await transactionCompleted(write);
    database.close();

    expect(await reconcileProgressGeneration(indexedDB, userA, newGeneration)).toBe(true);
    expect(await createBrowserProgressStore(indexedDB, userA).listAttempts()).toEqual([]);
    expect(await pendingCount(indexedDB, userA)).toBe(0);
    expect(await pendingCount(indexedDB, userB)).toBe(1);
    const reopened = await openLearningDatabase(indexedDB, userA);
    const read = reopened.transaction([ELEMENT_CARD_STORE, PRACTICE_SESSION_STORE], "readonly");
    expect(
      await requestCompleted(read.objectStore(ELEMENT_CARD_STORE).get("own-card")),
    ).toMatchObject({ id: "own-card" });
    expect(await requestCompleted(read.objectStore(PRACTICE_SESSION_STORE).count())).toBe(0);
    await transactionCompleted(read);
    reopened.close();
    await expect(
      createBrowserProgressStore(indexedDB, userA).appendAttempt({
        ...event,
        id: "stale",
        progressGeneration: INITIAL_PROGRESS_GENERATION,
      }),
    ).rejects.toThrow("resetován");
    await expect(
      createBrowserProgressStore(indexedDB, userA).appendAttempt({ ...event, id: "unbound" }),
    ).rejects.toThrow("resetován");
    await createBrowserProgressStore(indexedDB, userA).appendAttempt({
      ...event,
      id: "fresh",
      progressGeneration: newGeneration,
    });
    expect(await pendingCount(indexedDB, userA)).toBe(1);
    expect(await reconcileProgressGeneration(indexedDB, userA, newGeneration)).toBe(false);
  });
});
