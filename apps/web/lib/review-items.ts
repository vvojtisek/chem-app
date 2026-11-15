import type { AttemptEvent } from "./browser-progress-store";
import type { NomenclatureDirection } from "./nomenclature-session";
import {
  calculateItemMastery,
  calculatePeriodicTableMastery,
  weakestElements,
} from "./periodic-table-mastery";

export type EquationReviewLevel = "beginner" | "advanced" | "pro";

/** At most this many items go into one review round, so it stays a short round. */
export const REVIEW_ROUND_LIMIT = 10;

export interface ReviewSummary {
  readonly elementIds: readonly string[];
  readonly nomenclature: {
    readonly direction: NomenclatureDirection;
    readonly compoundIds: readonly string[];
  } | null;
  readonly equations: {
    readonly level: EquationReviewLevel;
    readonly questionIds: readonly string[];
  } | null;
}

const SEPARATOR = "|";

/**
 * Weakest rated items of one exercise variant (direction or level). The variant of the weakest
 * item is chosen and only items of that variant are returned, because a round asks in one way.
 */
function weakestOfOneVariant(
  attempts: readonly AttemptEvent[],
  keyOf: (attempt: AttemptEvent) => readonly [variant: string, id: string] | null,
  limit: number,
): { readonly variant: string; readonly ids: readonly string[] } | null {
  const weak = weakestElements(
    calculateItemMastery(attempts, (attempt) => keyOf(attempt)?.join(SEPARATOR) ?? null),
    Number.POSITIVE_INFINITY,
  );
  const [first] = weak;
  if (!first) return null;
  const variant = first.elementId.slice(0, first.elementId.indexOf(SEPARATOR));
  const ids = weak
    .filter((item) => item.elementId.startsWith(`${variant}${SEPARATOR}`))
    .slice(0, limit)
    .map((item) => item.elementId.slice(variant.length + SEPARATOR.length));
  return { variant, ids };
}

/**
 * Items to review across exercises, from the attempts on this device: rated items below 80 %
 * weighted accuracy (the Pokrok threshold), weakest first. Nothing is stored; the list is derived
 * from the attempt history each time.
 */
export function summarizeReview(
  attempts: readonly AttemptEvent[],
  limit = REVIEW_ROUND_LIMIT,
): ReviewSummary {
  const elementIds = weakestElements(calculatePeriodicTableMastery(attempts), limit).map(
    (item) => item.elementId,
  );
  const nomenclature = weakestOfOneVariant(
    attempts,
    (attempt) => (attempt.mode === "nomenclature" ? [attempt.direction, attempt.compoundId] : null),
    limit,
  );
  const equations = weakestOfOneVariant(
    attempts,
    (attempt) => (attempt.mode === "equation" ? [attempt.level, attempt.questionId] : null),
    limit,
  );
  return {
    elementIds,
    nomenclature: nomenclature
      ? {
          direction: nomenclature.variant as NomenclatureDirection,
          compoundIds: nomenclature.ids,
        }
      : null,
    equations: equations
      ? { level: equations.variant as EquationReviewLevel, questionIds: equations.ids }
      : null,
  };
}
