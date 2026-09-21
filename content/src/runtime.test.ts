import { describe, expect, it } from "vitest";

import {
  createCurriculumContentVersion,
  curatedElements,
  curatedGroups,
  curriculumContentVersion,
} from "./runtime";

describe("curriculumContentVersion", () => {
  it("is deterministically generated from the runtime curriculum snapshot", () => {
    const snapshot = {
      schemaVersion: 1,
      elements: curatedElements,
      groups: curatedGroups,
    };

    expect(curriculumContentVersion).toMatch(/^curriculum-v1-[a-f0-9]{8}$/u);
    expect(createCurriculumContentVersion(snapshot)).toBe(curriculumContentVersion);
  });

  it("changes when the runtime curriculum changes", () => {
    const firstElement = curatedElements[0];

    const changedVersion = createCurriculumContentVersion({
      schemaVersion: 1,
      elements: [{ ...firstElement, nameCs: "Změněný název" }, ...curatedElements.slice(1)],
      groups: curatedGroups,
    });

    expect(changedVersion).not.toBe(curriculumContentVersion);
  });
});
