import { beforeEach, describe, expect, it } from "vitest";
import { resetLearningDatabase } from "../browser-learning-database";
import { type AttemptEvent, createBrowserProgressStore } from "../browser-progress-store";
import {
  acknowledgeAttempts,
  pendingAttempts,
  pendingCount,
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
});
