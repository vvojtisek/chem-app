import { z } from "zod";

import type { CurrentUser } from "../api/client";
import { readStoredJson, removeStored, writeStoredJson } from "../local-preferences";
import { INITIAL_PROGRESS_GENERATION, progressGenerationSchema } from "../progress-generation";

export const ACCOUNT_MARKER_KEY = "inorganic.verified-account";
const markerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  userId: z.uuid(),
  username: z.string().min(1),
  role: z.enum(["admin", "user", "tester", "guest"]),
  verifiedAt: z.iso.datetime(),
  progressGeneration: progressGenerationSchema.optional(),
});

export type AccountMarker = Omit<z.infer<typeof markerSchema>, "progressGeneration"> & {
  progressGeneration: string;
};

export function readAccountMarker(): AccountMarker | null {
  const parsed = markerSchema.safeParse(readStoredJson(ACCOUNT_MARKER_KEY));
  return parsed.success
    ? {
        ...parsed.data,
        progressGeneration: parsed.data.progressGeneration ?? INITIAL_PROGRESS_GENERATION,
      }
    : null;
}

export function saveAccountMarker(user: CurrentUser): void {
  writeStoredJson(ACCOUNT_MARKER_KEY, {
    schemaVersion: 1,
    userId: user.id,
    username: user.username,
    role: user.role,
    verifiedAt: new Date().toISOString(),
    progressGeneration: user.progressGeneration,
  } satisfies AccountMarker);
}

export function clearAccountMarker(): void {
  removeStored(ACCOUNT_MARKER_KEY);
}

export function updateAccountMarkerProgressGeneration(userId: string, generation: string): void {
  const marker = readAccountMarker();
  if (!marker || marker.userId !== userId) return;
  writeStoredJson(ACCOUNT_MARKER_KEY, {
    ...marker,
    progressGeneration: progressGenerationSchema.parse(generation),
  } satisfies AccountMarker);
}
