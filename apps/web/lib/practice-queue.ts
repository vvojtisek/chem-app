import type { ExerciseRound } from "./exercise-session";
import { drawSeries } from "./periodic-table-scope";

export interface PracticeQueueQuestion {
  readonly id: string;
}

export interface PracticeQueueState<Question extends PracticeQueueQuestion> {
  readonly status: "running" | "finished";
  readonly current: Question | null;
  readonly queue: readonly Question[];
  readonly solvedIds: ReadonlySet<string>;
  readonly missedIds: ReadonlySet<string>;
  readonly correct: number;
  readonly incorrect: number;
  readonly total: number;
}

export interface PracticeQueueAnswer<Question extends PracticeQueueQuestion> {
  readonly state: PracticeQueueState<Question>;
  readonly question: Question;
  readonly isCorrect: boolean;
  readonly round: ExerciseRound;
}

export function createPracticeQueue<Question extends PracticeQueueQuestion>(
  questions: readonly Question[],
  random: () => number,
): PracticeQueueState<Question> {
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

export function answerPracticeQueue<Question extends PracticeQueueQuestion>(
  state: PracticeQueueState<Question>,
  isCorrect: boolean,
): PracticeQueueAnswer<Question> | null {
  const question = state.current;
  if (state.status !== "running" || !question) return null;

  const round: ExerciseRound = state.missedIds.has(question.id) ? "retry" : "initial";

  if (isCorrect) {
    const [next = null, ...queue] = state.queue;
    return {
      question,
      isCorrect,
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
    isCorrect,
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

export function answerPracticeQueueBySelection<Question extends PracticeQueueQuestion>(
  state: PracticeQueueState<Question>,
  selectedId: string,
): PracticeQueueAnswer<Question> | null {
  if (state.solvedIds.has(selectedId)) return null;
  return answerPracticeQueue(state, selectedId === state.current?.id);
}

export function finishPracticeQueue<Question extends PracticeQueueQuestion>(
  state: PracticeQueueState<Question>,
): PracticeQueueState<Question> {
  return { ...state, status: "finished", current: null };
}
