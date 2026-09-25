import { z } from "zod";

/** Existing events and clients without a generation belong to the first generation. */
export const INITIAL_PROGRESS_GENERATION = "00000000-0000-0000-0000-000000000000";
export const progressGenerationSchema = z.union([z.literal(INITIAL_PROGRESS_GENERATION), z.uuid()]);

export function attemptGeneration(value: { progressGeneration?: string | undefined }): string {
  return value.progressGeneration ?? INITIAL_PROGRESS_GENERATION;
}
