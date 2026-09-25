import { describe, expect, it } from "vitest";

import {
  answerPracticeQueue,
  answerPracticeQueueBySelection,
  createPracticeQueue,
  finishPracticeQueue,
  type PracticeQueueState,
} from "./practice-queue";

interface Question {
  readonly id: string;
}

const questions: readonly Question[] = [{ id: "h" }, { id: "he" }, { id: "li" }];
const keepOrder = () => 0.999_999;

function answer(state: PracticeQueueState<Question>, selectedId: string) {
  const result = answerPracticeQueueBySelection(state, selectedId);
  if (!result) throw new Error(`Answer ${selectedId} was ignored.`);
  return result;
}

describe("practice queue", () => {
  it("asks every question once in the injected random order", () => {
    const ordered = createPracticeQueue(questions, keepOrder);
    const shuffled = createPracticeQueue(questions, () => 0);

    expect([ordered.current, ...ordered.queue].map((question) => question?.id)).toEqual([
      "h",
      "he",
      "li",
    ]);
    expect([shuffled.current, ...shuffled.queue].map((question) => question?.id)).toEqual([
      "he",
      "li",
      "h",
    ]);
    expect(ordered).toMatchObject({ status: "running", correct: 0, incorrect: 0, total: 3 });
  });

  it("moves straight to the next question after a correct click", () => {
    const result = answer(createPracticeQueue(questions, keepOrder), "h");

    expect(result).toMatchObject({ isCorrect: true, round: "initial" });
    expect(result.state.current?.id).toBe("he");
    expect(result.state.correct).toBe(1);
    expect(result.state.solvedIds.has("h")).toBe(true);
  });

  it("moves on after a wrong click and asks the missed question again later as a retry", () => {
    let state = createPracticeQueue(questions, keepOrder);

    const miss = answer(state, "li");
    expect(miss).toMatchObject({ isCorrect: false, round: "initial" });
    expect(miss.state.current?.id).toBe("he");
    expect(miss.state.queue.map(({ id }) => id)).toEqual(["li", "h"]);
    expect(miss.state.incorrect).toBe(1);
    expect(miss.state.solvedIds.has("li")).toBe(false);

    state = answer(miss.state, "he").state;
    state = answer(state, "li").state;
    const retry = answer(state, "h");
    expect(retry).toMatchObject({ isCorrect: true, round: "retry" });
    expect(retry.state).toMatchObject({
      status: "finished",
      current: null,
      correct: 3,
      incorrect: 1,
    });
  });

  it("offers a missed question once more", () => {
    let state = createPracticeQueue([{ id: "h" }], keepOrder);

    state = answer(state, "he").state;
    expect(state).toMatchObject({ status: "running", incorrect: 1 });
    expect(state.current?.id).toBe("h");
    expect(answer(state, "h").state.status).toBe("finished");
  });

  it("finishes after a wrong retry without making an endless queue", () => {
    const first = answerPracticeQueue(createPracticeQueue([{ id: "h" }], keepOrder), false);
    expect(first?.round).toBe("initial");
    expect(first?.state.status).toBe("running");
    if (!first) return;

    const retry = answerPracticeQueue(first.state, false);
    expect(retry?.round).toBe("retry");
    expect(retry?.state).toMatchObject({
      status: "finished",
      current: null,
      queue: [],
      incorrect: 2,
      correct: 0,
    });
    expect(retry && answerPracticeQueue(retry.state, false)).toBeNull();
  });

  it("ignores clicks on already solved cells and after the exercise is finished", () => {
    const state = answer(createPracticeQueue(questions, keepOrder), "h").state;

    expect(answerPracticeQueueBySelection(state, "h")).toBeNull();
    expect(answerPracticeQueueBySelection(finishPracticeQueue(state), "he")).toBeNull();
  });

  it("accepts a typed answer's verdict for the current question", () => {
    const state = createPracticeQueue(questions, keepOrder);

    const miss = answerPracticeQueue(state, false);
    expect(miss).toMatchObject({ question: { id: "h" }, isCorrect: false, round: "initial" });
    expect(miss?.state.current?.id).toBe("he");

    const hit = miss ? answerPracticeQueue(miss.state, true) : null;
    expect(hit).toMatchObject({ question: { id: "he" }, isCorrect: true, round: "initial" });
    expect(hit?.state.solvedIds.has("he")).toBe(true);
    expect(answerPracticeQueue(finishPracticeQueue(state), true)).toBeNull();
  });

  it("finishes on request and keeps the score", () => {
    const state = finishPracticeQueue(answer(createPracticeQueue(questions, keepOrder), "h").state);

    expect(state).toMatchObject({ status: "finished", current: null, correct: 1, incorrect: 0 });
  });
});
