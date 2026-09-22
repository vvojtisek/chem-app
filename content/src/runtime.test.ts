import { describe, expect, it } from "vitest";

import {
  createCurriculumContentVersion,
  curatedElements,
  curatedGroups,
  curriculumContentVersion,
  toRuntimeElements,
  toRuntimeGroups,
} from "./runtime";
import type { ElementRecord, GroupRecord } from "./schema";

const reviewedHydrogen: ElementRecord = {
  id: "element.001-h",
  atomicNumber: 1,
  symbol: "H",
  nameCs: "Vodík",
  nameLat: "Hydrogenium",
  period: 1,
  group: 1,
  atomicWeight: 1.008,
  valenceConfiguration: "1s1",
  status: "reviewed",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:hydrogen" }],
  reviewedBy: "reviewer.fixture",
  reviewedAt: "2026-09-22",
};

const reviewedGroup: GroupRecord = {
  id: "periodic-group.1",
  groupNumber: 1,
  nameCs: "Alkalické kovy",
  mnemonicCs: "Fixture mnemonic",
  elementSymbols: ["H"],
  status: "reviewed",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:group-1" }],
  reviewedBy: "reviewer.fixture",
  reviewedAt: "2026-09-22",
};

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

describe("runtime curriculum selection", () => {
  it("ships only reviewed element records", () => {
    const unreviewed = (["draft", "in-review", "deprecated"] as const).map((status, index) => ({
      ...reviewedHydrogen,
      id: `element.unreviewed-${status}`,
      atomicNumber: index + 2,
      status,
    }));

    expect(toRuntimeElements([...unreviewed, reviewedHydrogen]).map(({ id }) => id)).toEqual([
      "element.001-h",
    ]);
  });

  it("ships only reviewed group records", () => {
    const draftGroup: GroupRecord = {
      ...reviewedGroup,
      id: "periodic-group.2",
      groupNumber: 2,
      status: "draft",
    };

    expect(
      toRuntimeGroups([draftGroup, reviewedGroup]).map(({ groupNumber }) => groupNumber),
    ).toEqual([1]);
  });
});
