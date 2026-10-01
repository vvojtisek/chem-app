import { z } from "zod";

import type { AttemptEvent } from "./browser-progress-store";
import { readStoredJson, writeStoredJson } from "./local-preferences";

const cachedGoalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  dailyGoal: z.number().int().min(1).max(500).nullable(),
});

function key(userId: string): string {
  return `inorganic.daily-goal.${userId}`;
}

/** A last-known value makes the dashboard useful while offline; the API owns the setting. */
export function readCachedDailyGoal(userId: string): number | null {
  const parsed = cachedGoalSchema.safeParse(readStoredJson(key(userId)));
  return parsed.success ? parsed.data.dailyGoal : null;
}

export function cacheDailyGoal(userId: string, dailyGoal: number | null): void {
  writeStoredJson(key(userId), cachedGoalSchema.parse({ schemaVersion: 1, dailyGoal }));
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Count submitted answers, including wrong answers and retries, in the learner's local day. */
export function countDailyAnswers(attempts: readonly AttemptEvent[], now: Date): number {
  const today = localDay(now);
  return attempts.filter((attempt) => localDay(new Date(attempt.occurredAt)) === today).length;
}
