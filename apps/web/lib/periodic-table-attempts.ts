import { curriculumContentVersion } from "@inorganic/content/runtime";

import { createBrowserProgressStore } from "./browser-progress-store";
import type { ExerciseRound } from "./exercise-session";

export type PeriodicTablePracticeDirection = "name-to-position" | "position-to-name-or-symbol";

export interface PeriodicTableAttempt {
  readonly questionId: string;
  readonly round: ExerciseRound;
  readonly isCorrect: boolean;
  readonly direction: PeriodicTablePracticeDirection;
}

export async function appendPeriodicTableAttempt(attempt: PeriodicTableAttempt): Promise<void> {
  await createBrowserProgressStore().appendAttempt({
    id: crypto.randomUUID(),
    questionId: attempt.questionId,
    contentVersion: curriculumContentVersion,
    occurredAt: new Date().toISOString(),
    isCorrect: attempt.isCorrect,
    round: attempt.round,
    mode: "periodic-table",
    direction: attempt.direction,
    matchPolicy:
      attempt.direction === "name-to-position" ? "exact-position" : "name-tolerant-or-symbol-exact",
  });
}

export function describeAttemptSaveFailure(error: unknown): string {
  return error instanceof Error
    ? `Pokus se nepodařilo uložit: ${error.message}`
    : "Pokus se nepodařilo uložit lokálně.";
}
