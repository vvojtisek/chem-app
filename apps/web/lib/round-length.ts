import { z } from "zod";

import { readStoredJson, writeStoredJson } from "./local-preferences";

/** Questions per round; `null` asks every selected item. */
export type RoundLength = 10 | 20 | null;

export const ROUND_LENGTHS: readonly RoundLength[] = [10, 20, null];
/** Default for long item sets such as nomenclature (468 compounds). */
export const DEFAULT_ROUND_LENGTH: RoundLength = 20;

const storedSchema = z.strictObject({
  schemaVersion: z.literal(1),
  length: z.union([z.literal(10), z.literal(20), z.null()]),
});

function key(exercise: string): string {
  return `inorganic.roundLength.${exercise}`;
}

/** Device-local preference (ADR 0003); a missing or corrupt value reads as `fallback`. */
export function loadRoundLength(
  exercise: string,
  fallback: RoundLength = DEFAULT_ROUND_LENGTH,
): RoundLength {
  const parsed = storedSchema.safeParse(readStoredJson(key(exercise)));
  return parsed.success ? parsed.data.length : fallback;
}

export function saveRoundLength(exercise: string, length: RoundLength): void {
  writeStoredJson(key(exercise), storedSchema.parse({ schemaVersion: 1, length }));
}

/** How many of `available` items a round asks. */
export function plannedRoundSize(available: number, length: RoundLength): number {
  return length === null ? available : Math.min(available, length);
}
