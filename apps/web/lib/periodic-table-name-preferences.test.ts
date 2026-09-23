import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadNamePracticeMode,
  loadNamePracticeSelection,
  NAME_PRACTICE_MODE_KEY,
  NAME_PRACTICE_SELECTION_KEY,
  saveNamePracticeMode,
  saveNamePracticeSelection,
} from "./periodic-table-name-preferences";

const known = new Set(["element.001-h", "element.002-he", "element.003-li"]);

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("periodic-table name practice preferences", () => {
  it("restores a saved selection and mode", () => {
    saveNamePracticeSelection(new Set(["element.003-li", "element.001-h"]));
    saveNamePracticeMode("symbol-to-name");

    expect(loadNamePracticeSelection(known)).toEqual(new Set(["element.001-h", "element.003-li"]));
    expect(loadNamePracticeMode()).toBe("symbol-to-name");
    expect(JSON.parse(window.localStorage.getItem(NAME_PRACTICE_SELECTION_KEY) ?? "")).toEqual({
      schemaVersion: 1,
      elementIds: ["element.001-h", "element.003-li"],
    });
  });

  it("restores a deliberately empty selection", () => {
    saveNamePracticeSelection(new Set());

    expect(loadNamePracticeSelection(known)).toEqual(new Set());
  });

  it("returns null when nothing is stored", () => {
    expect(loadNamePracticeSelection(known)).toBeNull();
    expect(loadNamePracticeMode()).toBeNull();
  });

  it("drops element IDs that the current content no longer contains", () => {
    window.localStorage.setItem(
      NAME_PRACTICE_SELECTION_KEY,
      JSON.stringify({ schemaVersion: 1, elementIds: ["element.001-h", "element.999-xx"] }),
    );

    expect(loadNamePracticeSelection(known)).toEqual(new Set(["element.001-h"]));
  });

  it.each([
    ["corrupt JSON", "{"],
    ["an unknown schema version", JSON.stringify({ schemaVersion: 2, elementIds: [] })],
    ["a missing version", JSON.stringify({ elementIds: ["element.001-h"] })],
    ["extra fields", JSON.stringify({ schemaVersion: 1, elementIds: [], extra: true })],
    ["a non-string ID", JSON.stringify({ schemaVersion: 1, elementIds: [1] })],
  ])("ignores a selection with %s", (_, stored) => {
    window.localStorage.setItem(NAME_PRACTICE_SELECTION_KEY, stored);

    expect(loadNamePracticeSelection(known)).toBeNull();
  });

  it.each([
    ["corrupt JSON", "name-to-symbol"],
    ["an unknown mode", JSON.stringify({ schemaVersion: 1, mode: "position-to-name" })],
    ["an unknown schema version", JSON.stringify({ schemaVersion: 2, mode: "name-to-symbol" })],
  ])("ignores a mode with %s", (_, stored) => {
    window.localStorage.setItem(NAME_PRACTICE_MODE_KEY, stored);

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
    expect(() => saveNamePracticeSelection(known)).not.toThrow();
    expect(loadNamePracticeMode()).toBeNull();
    expect(loadNamePracticeSelection(known)).toBeNull();
  });
});
