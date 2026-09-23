import { beforeEach, describe, expect, it } from "vitest";
import { createExerciseSession } from "./exercise-session";
import { resetLearningDatabase } from "./browser-learning-database";
import { createBrowserNomenclatureStore } from "./browser-nomenclature-store";
import {
  createBrowserProgressStore,
  type NomenclatureAttemptEvent,
} from "./browser-progress-store";
import type { NomenclatureCheckpoint, NomenclatureQuestion } from "./nomenclature-session";

const question: NomenclatureQuestion = {
  id: "nomenclature.fixture-agcl",
  reviewLevel: "sme-reviewed",
  questionId: "nomenclature.fixture-agcl.formula-to-name",
  formula: "AgCl",
  nameCs: "chlorid stříbrný",
  explanationCs: "Fixture explanation.",
  baseCategory: "binary-salt",
  tags: [],
  difficulty: "basic",
  contextCs: null,
  directions: ["formula-to-name"],
  direction: "formula-to-name",
  nameAliases: [],
  formulaAliases: [],
};
const created = createExerciseSession([question]);
if (!created.ok) throw new Error("Fixture session failed.");

const checkpoint: NomenclatureCheckpoint = {
  id: "active",
  revision: 1,
  sessionId: "session.fixture",
  contentVersion: "fixture-v1",
  seed: 1,
  initialCount: 1,
  sequence: 1,
  revealedInitial: 0,
  revealedRetry: 0,
  settings: {
    categories: ["binary-salt"],
    difficulties: ["basic"],
    direction: "formula-to-name",
    namePolicy: "strict",
    length: 10,
  },
  state: created.state,
  input: "",
  feedback: null,
};

const attempt: NomenclatureAttemptEvent = {
  id: "session.fixture:0",
  eventSchemaVersion: 1,
  sessionId: "session.fixture",
  sequence: 0,
  questionId: question.questionId,
  compoundId: question.id,
  contentVersion: "fixture-v1",
  occurredAt: "2026-09-22T12:00:00.000Z",
  isCorrect: true,
  round: "initial",
  mode: "nomenclature",
  outcome: "correct",
  match: "canonical",
  direction: "formula-to-name",
  matchPolicy: "name-strict",
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
});
