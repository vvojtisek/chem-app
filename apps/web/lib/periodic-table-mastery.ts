import type { AttemptEvent } from "./browser-progress-store";

export type MasteryLevel = "no-data" | "starting" | "low" | "developing" | "mastered";

export interface ElementMastery {
  readonly level: MasteryLevel;
  readonly attempts: number;
  readonly correct: number;
  readonly weightedAccuracy: number | null;
}

/** Three answers are required before an element can receive a skill rating. */
export const MIN_MASTERY_ATTEMPTS = 3;

const EMPTY_MASTERY: ElementMastery = {
  level: "no-data",
  attempts: 0,
  correct: 0,
  weightedAccuracy: null,
};

export function calculatePeriodicTableMastery(
  attempts: readonly AttemptEvent[],
): ReadonlyMap<string, ElementMastery> {
  const byElement = new Map<string, Extract<AttemptEvent, { mode: "periodic-table" }>[]>();
  for (const attempt of attempts) {
    if (attempt.mode !== "periodic-table") continue;
    const group = byElement.get(attempt.questionId) ?? [];
    group.push(attempt);
    byElement.set(attempt.questionId, group);
  }

  const result = new Map<string, ElementMastery>();
  for (const [questionId, group] of byElement) {
    const chronological = [...group].sort((left, right) =>
      left.occurredAt === right.occurredAt
        ? left.id.localeCompare(right.id)
        : left.occurredAt.localeCompare(right.occurredAt),
    );
    // Each newer answer has twice the weight of the preceding answer. Normalizing
    // against the newest event avoids overflow even for a long practice history.
    let totalWeight = 0;
    let correctWeight = 0;
    for (const [index, attempt] of chronological.entries()) {
      const weight = 0.5 ** (chronological.length - index - 1);
      totalWeight += weight;
      if (attempt.isCorrect) correctWeight += weight;
    }
    const weightedAccuracy = correctWeight / totalWeight;
    const count = chronological.length;
    result.set(questionId, {
      level:
        count < MIN_MASTERY_ATTEMPTS
          ? "starting"
          : weightedAccuracy < 0.5
            ? "low"
            : weightedAccuracy < 0.8
              ? "developing"
              : "mastered",
      attempts: count,
      correct: chronological.filter((attempt) => attempt.isCorrect).length,
      weightedAccuracy,
    });
  }
  return result;
}

export function masteryForElement(
  mastery: ReadonlyMap<string, ElementMastery>,
  elementId: string,
): ElementMastery {
  return mastery.get(elementId) ?? EMPTY_MASTERY;
}

export interface WeakElement {
  readonly elementId: string;
  readonly mastery: ElementMastery;
}

/**
 * Rated elements that still need practice (below 80 % weighted accuracy), weakest first. Elements
 * with fewer than MIN_MASTERY_ATTEMPTS answers have no rating and are left out.
 */
export function weakestElements(
  mastery: ReadonlyMap<string, ElementMastery>,
  limit: number,
): readonly WeakElement[] {
  return [...mastery]
    .filter(([, state]) => state.level === "low" || state.level === "developing")
    .sort(
      ([leftId, left], [rightId, right]) =>
        (left.weightedAccuracy ?? 0) - (right.weightedAccuracy ?? 0) ||
        right.attempts - left.attempts ||
        leftId.localeCompare(rightId),
    )
    .slice(0, limit)
    .map(([elementId, state]) => ({ elementId, mastery: state }));
}
