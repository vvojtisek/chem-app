import { curriculumContentVersion } from "@inorganic/content/runtime";

import { createBrowserProgressStore } from "./browser-progress-store";
import type { ExerciseRound } from "./practice-queue";

export type PeriodicTablePracticeDirection =
  | "name-to-position"
  | "name-to-symbol"
  | "symbol-to-name";

export interface PeriodicTableAttempt {
  readonly questionId: string;
  readonly round: ExerciseRound;
  readonly isCorrect: boolean;
  readonly direction: PeriodicTablePracticeDirection;
}

export async function appendPeriodicTableAttempt(attempt: PeriodicTableAttempt): Promise<void> {
  const store = createBrowserProgressStore();
  const base = {
    id: crypto.randomUUID(),
    questionId: attempt.questionId,
    contentVersion: curriculumContentVersion,
    occurredAt: new Date().toISOString(),
    isCorrect: attempt.isCorrect,
    round: attempt.round,
    mode: "periodic-table",
  } as const;

  switch (attempt.direction) {
    case "name-to-position":
      return store.appendAttempt({
        ...base,
        direction: attempt.direction,
        matchPolicy: "exact-position",
      });
    case "name-to-symbol":
      return store.appendAttempt({
        ...base,
        direction: attempt.direction,
        matchPolicy: "symbol-exact",
      });
    case "symbol-to-name":
      return store.appendAttempt({
        ...base,
        direction: attempt.direction,
        matchPolicy: "diacritics-tolerant",
      });
  }
}

export function describeAttemptSaveFailure(error: unknown): string {
  return error instanceof Error
    ? `Pokus se nepodařilo uložit: ${error.message}`
    : "Pokus se nepodařilo uložit lokálně.";
}
