import type { ExerciseRound } from "./exercise-session";
import { drawSeries } from "./periodic-table-scope";

export interface BlindTableQuestion {
  readonly id: string;
}

export interface BlindTableState<Question extends BlindTableQuestion> {
  readonly status: "running" | "finished";
  readonly current: Question | null;
  readonly queue: readonly Question[];
  readonly solvedIds: ReadonlySet<string>;
  readonly missedIds: ReadonlySet<string>;
  readonly correct: number;
  readonly incorrect: number;
  readonly total: number;
}

export interface BlindTableAnswer<Question extends BlindTableQuestion> {
  readonly state: BlindTableState<Question>;
  readonly question: Question;
  readonly isCorrect: boolean;
  readonly round: ExerciseRound;
}

export function createBlindTableSession<Question extends BlindTableQuestion>(
  questions: readonly Question[],
  random: () => number,
): BlindTableState<Question> {
  const [current = null, ...queue] = drawSeries(questions, questions.length, random);

  return {
    status: current ? "running" : "finished",
    current,
    queue,
    solvedIds: new Set(),
    missedIds: new Set(),
    correct: 0,
    incorrect: 0,
    total: questions.length,
  };
}

export function answerBlindTable<Question extends BlindTableQuestion>(
  state: BlindTableState<Question>,
  selectedId: string,
): BlindTableAnswer<Question> | null {
  const question = state.current;
  if (state.status !== "running" || !question || state.solvedIds.has(selectedId)) return null;

  const round: ExerciseRound = state.missedIds.has(question.id) ? "retry" : "initial";

  if (selectedId === question.id) {
    const [next = null, ...queue] = state.queue;
    return {
      question,
      isCorrect: true,
      round,
      state: {
        ...state,
        status: next ? "running" : "finished",
        current: next,
        queue,
        solvedIds: new Set(state.solvedIds).add(question.id),
        correct: state.correct + 1,
      },
    };
  }

  const [next = question, ...queue] = [...state.queue, question];
  return {
    question,
    isCorrect: false,
    round,
    state: {
      ...state,
      current: next,
      queue,
      missedIds: new Set(state.missedIds).add(question.id),
      incorrect: state.incorrect + 1,
    },
  };
}

export function finishBlindTable<Question extends BlindTableQuestion>(
  state: BlindTableState<Question>,
): BlindTableState<Question> {
  return { ...state, status: "finished", current: null };
}
