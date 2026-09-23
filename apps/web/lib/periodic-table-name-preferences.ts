import { z } from "zod";

export type ElementPromptMode = "name-to-symbol" | "symbol-to-name";

export const DEFAULT_ELEMENT_PROMPT_MODE: ElementPromptMode = "name-to-symbol";
export const NAME_PRACTICE_SELECTION_KEY = "inorganic.periodic-table-name-practice.selection";
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
 * Restores the stored element selection, keeping only IDs present in the current content.
 * Returns null when nothing valid is stored, so the caller falls back to its default.
 */
export function loadNamePracticeSelection(
  knownElementIds: ReadonlySet<string>,
): ReadonlySet<string> | null {
  const parsed = selectionSchema.safeParse(readStoredJson(NAME_PRACTICE_SELECTION_KEY));
  if (!parsed.success) return null;
  return new Set(parsed.data.elementIds.filter((id) => knownElementIds.has(id)));
}

export function saveNamePracticeSelection(selection: ReadonlySet<string>): void {
  writeStoredJson(NAME_PRACTICE_SELECTION_KEY, {
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

// Preferences are a convenience: blocked or full storage (DOMException) and
// corrupt JSON (SyntaxError) fall back to defaults instead of breaking practice.
function readStoredJson(key: string): unknown {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
  if (raw === null) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function writeStoredJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}
