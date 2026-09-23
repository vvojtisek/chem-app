import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ELEMENT_SELECTION_KEY,
  LEGACY_ELEMENT_SELECTION_KEY,
  loadElementSelection,
  loadNamePracticeMode,
  NAME_PRACTICE_MODE_KEY,
  saveElementSelection,
  saveNamePracticeMode,
} from "./periodic-table-preferences";

const known = new Set(["element.001-h", "element.002-he", "element.003-li"]);

function stored(key: string): unknown {
  return JSON.parse(window.localStorage.getItem(key) ?? "null");
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("periodic-table preferences", () => {
  it("restores a saved selection and mode", () => {
    saveElementSelection(new Set(["element.003-li", "element.001-h"]));
    saveNamePracticeMode("symbol-to-name");

    expect(loadElementSelection(known)).toEqual(new Set(["element.001-h", "element.003-li"]));
    expect(loadNamePracticeMode()).toBe("symbol-to-name");
    expect(stored("selected_pt_elements")).toEqual({
      schemaVersion: 1,
      elementIds: ["element.001-h", "element.003-li"],
    });
  });

  it("restores a deliberately empty selection", () => {
    saveElementSelection(new Set());

    expect(loadElementSelection(known)).toEqual(new Set());
  });

  it("returns null when nothing is stored", () => {
    expect(loadElementSelection(known)).toBeNull();
    expect(loadNamePracticeMode()).toBeNull();
  });

  it("drops element IDs that the current content no longer contains", () => {
    window.localStorage.setItem(
      ELEMENT_SELECTION_KEY,
      JSON.stringify({ schemaVersion: 1, elementIds: ["element.001-h", "element.999-xx"] }),
    );

    expect(loadElementSelection(known)).toEqual(new Set(["element.001-h"]));
  });

  it("moves a selection saved by the earlier name practice to the shared key once", () => {
    window.localStorage.setItem(
      LEGACY_ELEMENT_SELECTION_KEY,
      JSON.stringify({ schemaVersion: 1, elementIds: ["element.002-he"] }),
    );

    expect(loadElementSelection(known)).toEqual(new Set(["element.002-he"]));
    expect(stored(ELEMENT_SELECTION_KEY)).toEqual({
      schemaVersion: 1,
      elementIds: ["element.002-he"],
    });
    expect(window.localStorage.getItem(LEGACY_ELEMENT_SELECTION_KEY)).toBeNull();
  });

  it("prefers the shared selection over a leftover legacy one", () => {
    saveElementSelection(new Set(["element.001-h"]));
    window.localStorage.setItem(
      LEGACY_ELEMENT_SELECTION_KEY,
      JSON.stringify({ schemaVersion: 1, elementIds: ["element.002-he"] }),
    );

    expect(loadElementSelection(known)).toEqual(new Set(["element.001-h"]));
  });

  it.each([
    ["corrupt JSON", "{"],
    ["an unknown schema version", JSON.stringify({ schemaVersion: 2, elementIds: [] })],
    ["a missing version", JSON.stringify({ elementIds: ["element.001-h"] })],
    ["extra fields", JSON.stringify({ schemaVersion: 1, elementIds: [], extra: true })],
    ["a non-string ID", JSON.stringify({ schemaVersion: 1, elementIds: [1] })],
  ])("ignores a selection with %s", (_, value) => {
    window.localStorage.setItem(ELEMENT_SELECTION_KEY, value);

    expect(loadElementSelection(known)).toBeNull();
  });

  it.each([
    ["corrupt JSON", "name-to-symbol"],
    ["an unknown mode", JSON.stringify({ schemaVersion: 1, mode: "position-to-name" })],
    ["an unknown schema version", JSON.stringify({ schemaVersion: 2, mode: "name-to-symbol" })],
  ])("ignores a mode with %s", (_, value) => {
    window.localStorage.setItem(NAME_PRACTICE_MODE_KEY, value);

    expect(loadNamePracticeMode()).toBeNull();
  });

  it("falls back to defaults when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });

    expect(() => saveNamePracticeMode("symbol-to-name")).not.toThrow();
    expect(() => saveElementSelection(known)).not.toThrow();
    expect(loadNamePracticeMode()).toBeNull();
    expect(loadElementSelection(known)).toBeNull();
  });
});
