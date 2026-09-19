import { describe, expect, it } from "vitest";

import {
  advanceExerciseSession,
  createExerciseSession,
  submitExerciseAnswer,
  type ExerciseQuestion,
} from "./exercise-session";

interface Question extends ExerciseQuestion {
  readonly prompt: string;
}

const questions = [
  { id: "question.hydrogen", prompt: "H" },
  { id: "question.helium", prompt: "He" },
] as const satisfies readonly Question[];

describe("createExerciseSession", () => {
  it("rejects an empty or duplicate question list", () => {
    expect(createExerciseSession([])).toEqual({ ok: false, error: "empty_session" });
    expect(createExerciseSession([questions[0], questions[0]])).toEqual({
      ok: false,
      error: "duplicate_question_id",
    });
  });

  it("creates an initial active question", () => {
    const result = createExerciseSession(questions);

    expect(result).toMatchObject({
      ok: true,
      state: {
        status: "active",
        current: questions[0],
        round: "initial",
      },
    });
  });
});

describe("exercise-session transitions", () => {
  it("retries each missed original question exactly once", () => {
    const created = createExerciseSession(questions);
    if (!created.ok || created.state.status !== "active") {
      throw new Error("Expected a session to be created.");
    }

    const firstFeedback = submitExerciseAnswer(created.state, false);
    const secondActive = advanceExerciseSession(firstFeedback);
    if (secondActive.status !== "active") {
      throw new Error("Expected the second original question.");
    }

    const secondFeedback = submitExerciseAnswer(secondActive, true);
    const retryActive = advanceExerciseSession(secondFeedback);
    if (retryActive.status !== "active") {
      throw new Error("Expected a retry question.");
    }

    expect(retryActive).toMatchObject({
      current: questions[0],
      round: "retry",
      retryQueue: [],
    });

    const retryFeedback = submitExerciseAnswer(retryActive, false);
    const complete = advanceExerciseSession(retryFeedback);

    expect(complete).toEqual({
      status: "complete",
      summary: {
        initialCorrect: 1,
        initialIncorrect: 1,
        retryCorrect: 0,
        retryIncorrect: 1,
      },
    });
  });
});
