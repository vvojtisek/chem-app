import { z } from "zod";

import { readStoredJson, removeStored, writeStoredJson } from "./local-preferences";

export type ElementPromptMode = "name-to-symbol" | "symbol-to-name";

export const DEFAULT_ELEMENT_PROMPT_MODE: ElementPromptMode = "name-to-symbol";
/** Shared by every periodic-table exercise, so one selection applies everywhere. */
export const ELEMENT_SELECTION_KEY = "selected_pt_elements";
/** Written by the name/symbol practice before the selection became shared. */
export const LEGACY_ELEMENT_SELECTION_KEY = "inorganic.periodic-table-name-practice.selection";
export const NAME_PRACTICE_MODE_KEY = "inorganic.periodic-table-name-practice.mode";

const selectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  elementIds: z.array(z.string().min(1)).max(500),
});

const modeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.enum(["name-to-symbol", "symbol-to-name"]),
});

/**
 * Restores the shared element selection, keeping only IDs present in the current content.
 * When the shared key holds no valid selection, one saved under the legacy key is moved over.
 * Returns null when nothing valid is stored, so the caller falls back to its default.
 */
export function loadElementSelection(
  knownElementIds: ReadonlySet<string>,
): ReadonlySet<string> | null {
  const shared = selectionSchema.safeParse(readStoredJson(ELEMENT_SELECTION_KEY));
  const elementIds = shared.success ? shared.data.elementIds : migrateLegacySelection();
  if (!elementIds) return null;
  return new Set(elementIds.filter((id) => knownElementIds.has(id)));
}

function migrateLegacySelection(): readonly string[] | null {
  const legacy = selectionSchema.safeParse(readStoredJson(LEGACY_ELEMENT_SELECTION_KEY));
  if (!legacy.success) return null;
  writeStoredJson(ELEMENT_SELECTION_KEY, legacy.data);
  removeStored(LEGACY_ELEMENT_SELECTION_KEY);
  return legacy.data.elementIds;
}

export function saveElementSelection(selection: ReadonlySet<string>): void {
  writeStoredJson(ELEMENT_SELECTION_KEY, {
    schemaVersion: 1,
    elementIds: [...selection].sort(),
  } satisfies z.infer<typeof selectionSchema>);
}

export function loadNamePracticeMode(): ElementPromptMode | null {
  const parsed = modeSchema.safeParse(readStoredJson(NAME_PRACTICE_MODE_KEY));
  return parsed.success ? parsed.data.mode : null;
}

export function saveNamePracticeMode(mode: ElementPromptMode): void {
  writeStoredJson(NAME_PRACTICE_MODE_KEY, {
    schemaVersion: 1,
    mode,
  } satisfies z.infer<typeof modeSchema>);
}
