import { nomenclatureDirectionSchema } from "@inorganic/content/nomenclature-schema";
import { z } from "zod";
import { readStoredJson, removeStored, writeStoredJson } from "./local-preferences";

const ids = z.array(z.string().min(1).max(200)).min(1).max(50);

const reviewRequestSchema = z.discriminatedUnion("exercise", [
  z.strictObject({
    schemaVersion: z.literal(1),
    exercise: z.literal("nomenclature"),
    direction: nomenclatureDirectionSchema,
    ids,
  }),
  z.strictObject({
    schemaVersion: z.literal(1),
    exercise: z.literal("equations"),
    level: z.enum(["beginner", "advanced", "pro"]),
    ids,
  }),
]);

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewExercise = ReviewRequest["exercise"];

function requestKey(exercise: ReviewExercise): string {
  return `inorganic.reviewRequest.${exercise}`;
}

/**
 * Hands a review round from the home page to an exercise page on this device (ADR 0003
 * preference storage). The exercise takes it once on opening; it is never sent anywhere.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function saveReviewRequest(request: DistributiveOmit<ReviewRequest, "schemaVersion">): void {
  writeStoredJson(requestKey(request.exercise), { schemaVersion: 1, ...request });
}

export function takeReviewRequest<E extends ReviewExercise>(
  exercise: E,
): Extract<ReviewRequest, { exercise: E }> | null {
  const stored = readStoredJson(requestKey(exercise));
  if (stored === null) return null;
  removeStored(requestKey(exercise));
  const parsed = reviewRequestSchema.safeParse(stored);
  if (!parsed.success || parsed.data.exercise !== exercise) return null;
  return parsed.data as Extract<ReviewRequest, { exercise: E }>;
}
