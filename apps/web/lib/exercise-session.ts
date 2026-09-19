export interface ExerciseQuestion {
  readonly id: string;
}

export interface ExerciseSessionSummary {
  readonly initialCorrect: number;
  readonly initialIncorrect: number;
  readonly retryCorrect: number;
  readonly retryIncorrect: number;
}

export type ExerciseRound = "initial" | "retry";

export type ExerciseSessionState<Question extends ExerciseQuestion> =
  | {
      readonly status: "active";
      readonly current: Question;
      readonly remaining: readonly Question[];
      readonly retryQueue: readonly Question[];
      readonly round: ExerciseRound;
      readonly summary: ExerciseSessionSummary;
    }
  | {
      readonly status: "feedback";
      readonly current: Question;
      readonly remaining: readonly Question[];
      readonly retryQueue: readonly Question[];
      readonly round: ExerciseRound;
      readonly isCorrect: boolean;
      readonly summary: ExerciseSessionSummary;
    }
  | {
      readonly status: "complete";
      readonly summary: ExerciseSessionSummary;
    };

export type ExerciseSessionCreationResult<Question extends ExerciseQuestion> =
  | { readonly ok: true; readonly state: ExerciseSessionState<Question> }
  | {
      readonly ok: false;
      readonly error: "empty_session" | "duplicate_question_id";
    };

const EMPTY_SUMMARY: ExerciseSessionSummary = {
  initialCorrect: 0,
  initialIncorrect: 0,
  retryCorrect: 0,
  retryIncorrect: 0,
};

export function createExerciseSession<Question extends ExerciseQuestion>(
  questions: readonly Question[],
): ExerciseSessionCreationResult<Question> {
  if (questions.length === 0) {
    return { ok: false, error: "empty_session" };
  }

  const questionIds = new Set(questions.map((question) => question.id));
  if (questionIds.size !== questions.length) {
    return { ok: false, error: "duplicate_question_id" };
  }

  const [current, ...remaining] = questions;
  if (!current) {
    return { ok: false, error: "empty_session" };
  }

  return {
    ok: true,
    state: {
      status: "active",
      current,
      remaining,
      retryQueue: [],
      round: "initial",
      summary: EMPTY_SUMMARY,
    },
  };
}

export function submitExerciseAnswer<Question extends ExerciseQuestion>(
  state: Extract<ExerciseSessionState<Question>, { readonly status: "active" }>,
  isCorrect: boolean,
): Extract<ExerciseSessionState<Question>, { readonly status: "feedback" }> {
  const summary = updateSummary(state.summary, state.round, isCorrect);
  const retryQueue =
    state.round === "initial" && !isCorrect
      ? [...state.retryQueue, state.current]
      : state.retryQueue;

  return {
    status: "feedback",
    current: state.current,
    remaining: state.remaining,
    retryQueue,
    round: state.round,
    isCorrect,
    summary,
  };
}

export function advanceExerciseSession<Question extends ExerciseQuestion>(
  state: Extract<ExerciseSessionState<Question>, { readonly status: "feedback" }>,
): ExerciseSessionState<Question> {
  const [nextQuestion, ...remaining] = state.remaining;
  if (nextQuestion) {
    return {
      status: "active",
      current: nextQuestion,
      remaining,
      retryQueue: state.retryQueue,
      round: state.round,
      summary: state.summary,
    };
  }

  if (state.round === "initial" && state.retryQueue.length > 0) {
    const [retryQuestion, ...retryRemaining] = state.retryQueue;
    if (!retryQuestion) {
      return { status: "complete", summary: state.summary };
    }

    return {
      status: "active",
      current: retryQuestion,
      remaining: retryRemaining,
      retryQueue: [],
      round: "retry",
      summary: state.summary,
    };
  }

  return { status: "complete", summary: state.summary };
}

function updateSummary(
  summary: ExerciseSessionSummary,
  round: ExerciseRound,
  isCorrect: boolean,
): ExerciseSessionSummary {
  if (round === "initial") {
    return isCorrect
      ? { ...summary, initialCorrect: summary.initialCorrect + 1 }
      : { ...summary, initialIncorrect: summary.initialIncorrect + 1 };
  }

  return isCorrect
    ? { ...summary, retryCorrect: summary.retryCorrect + 1 }
    : { ...summary, retryIncorrect: summary.retryIncorrect + 1 };
}
