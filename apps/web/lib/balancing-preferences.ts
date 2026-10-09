import { z } from "zod";

import { readStoredJson, writeStoredJson } from "./local-preferences";

export const BALANCING_SELECTION_KEY = "inorganic.balancing.selection";
export const BALANCING_COMPLETED_KEY = "inorganic.balancing.completed";

const lessonIdsSchema = z.array(z.string().min(1)).max(1000);

const storedSelectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  lessonIds: lessonIdsSchema,
  shuffle: z.boolean(),
});

const storedCompletedSchema = z.strictObject({
  schemaVersion: z.literal(1),
  lessonIds: lessonIdsSchema,
});

export interface BalancingSelection {
  readonly lessonIds: readonly string[];
  readonly shuffle: boolean;
}

/** Stored ids that no longer name a lesson (content changed since they were saved) are dropped. */
function knownIds(ids: readonly string[], knownLessonIds: ReadonlySet<string>): string[] {
  return [...new Set(ids)].filter((id) => knownLessonIds.has(id));
}

export function loadBalancingSelection(
  knownLessonIds: ReadonlySet<string>,
): BalancingSelection | null {
  const parsed = storedSelectionSchema.safeParse(readStoredJson(BALANCING_SELECTION_KEY));
  if (!parsed.success) return null;
  return {
    lessonIds: knownIds(parsed.data.lessonIds, knownLessonIds),
    shuffle: parsed.data.shuffle,
  };
}

export function saveBalancingSelection(selection: BalancingSelection): void {
  writeStoredJson(BALANCING_SELECTION_KEY, {
    schemaVersion: 1,
    lessonIds: [...selection.lessonIds],
    shuffle: selection.shuffle,
  } satisfies z.infer<typeof storedSelectionSchema>);
}

/** Lessons walked through to the summary on this device; a convenience marker, not progress. */
export function loadCompletedBalancingLessons(knownLessonIds: ReadonlySet<string>): string[] {
  const parsed = storedCompletedSchema.safeParse(readStoredJson(BALANCING_COMPLETED_KEY));
  return parsed.success ? knownIds(parsed.data.lessonIds, knownLessonIds) : [];
}

export function saveCompletedBalancingLessons(lessonIds: readonly string[]): void {
  writeStoredJson(BALANCING_COMPLETED_KEY, {
    schemaVersion: 1,
    lessonIds: [...lessonIds],
  } satisfies z.infer<typeof storedCompletedSchema>);
}
