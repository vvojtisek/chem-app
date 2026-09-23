import { describe, expect, it } from "vitest";

import {
  answerBlindTable,
  type BlindTableState,
  createBlindTableSession,
  finishBlindTable,
} from "./blind-table-session";

interface Question {
  readonly id: string;
}

const questions: readonly Question[] = [{ id: "h" }, { id: "he" }, { id: "li" }];
const keepOrder = () => 0.999_999;

function answer(state: BlindTableState<Question>, selectedId: string) {
  const result = answerBlindTable(state, selectedId);
  if (!result) throw new Error(`Answer ${selectedId} was ignored.`);
  return result;
}

describe("blind table session", () => {
  it("asks every question once in the injected random order", () => {
    const ordered = createBlindTableSession(questions, keepOrder);
    const shuffled = createBlindTableSession(questions, () => 0);

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
    const result = answer(createBlindTableSession(questions, keepOrder), "h");

    expect(result).toMatchObject({ isCorrect: true, round: "initial" });
    expect(result.state.current?.id).toBe("he");
    expect(result.state.correct).toBe(1);
    expect(result.state.solvedIds.has("h")).toBe(true);
  });

  it("moves on after a wrong click and asks the missed question again later as a retry", () => {
    let state = createBlindTableSession(questions, keepOrder);

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

  it("asks the last missed question again until it is placed", () => {
    let state = createBlindTableSession([{ id: "h" }], keepOrder);

    state = answer(state, "he").state;
    expect(state).toMatchObject({ status: "running", incorrect: 1 });
    expect(state.current?.id).toBe("h");
    expect(answer(state, "h").state.status).toBe("finished");
  });

  it("ignores clicks on already solved cells and after the exercise is finished", () => {
    const state = answer(createBlindTableSession(questions, keepOrder), "h").state;

    expect(answerBlindTable(state, "h")).toBeNull();
    expect(answerBlindTable(finishBlindTable(state), "he")).toBeNull();
  });

  it("finishes on request and keeps the score", () => {
    const state = finishBlindTable(
      answer(createBlindTableSession(questions, keepOrder), "h").state,
    );

    expect(state).toMatchObject({ status: "finished", current: null, correct: 1, incorrect: 0 });
  });
});
