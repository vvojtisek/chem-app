import { z } from "zod";

import type { CurrentUser } from "../api/client";
import { readStoredJson, removeStored, writeStoredJson } from "../local-preferences";

export const ACCOUNT_MARKER_KEY = "inorganic.verified-account";
const markerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  userId: z.uuid(),
  username: z.string().min(1),
  role: z.enum(["admin", "user", "tester", "guest"]),
  verifiedAt: z.iso.datetime(),
});

export type AccountMarker = z.infer<typeof markerSchema>;

export function readAccountMarker(): AccountMarker | null {
  const parsed = markerSchema.safeParse(readStoredJson(ACCOUNT_MARKER_KEY));
  return parsed.success ? parsed.data : null;
}

export function saveAccountMarker(user: CurrentUser): void {
  writeStoredJson(ACCOUNT_MARKER_KEY, {
    schemaVersion: 1,
    userId: user.id,
    username: user.username,
    role: user.role,
    verifiedAt: new Date().toISOString(),
  } satisfies AccountMarker);
}

export function clearAccountMarker(): void {
  removeStored(ACCOUNT_MARKER_KEY);
}
