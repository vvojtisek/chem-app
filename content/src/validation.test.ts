import { describe, expect, it } from "vitest";

import type { ElementRecord } from "./schema";
import { findElementCollectionProblems } from "./validation";

const hydrogen: ElementRecord = {
  id: "element.hydrogen",
  atomicNumber: 1,
  symbol: "H",
  nameCs: "vodík",
  nameLat: "hydrogenium",
  period: 1,
  group: 1,
  atomicWeight: 1.008,
  valenceConfiguration: "1s1",
  status: "draft",
  author: "fixture",
  sources: [{ title: "Fixture source", locator: "fixture:hydrogen" }],
};

describe("findElementCollectionProblems", () => {
  it("accepts records with unique stable identity fields", () => {
    expect(findElementCollectionProblems([hydrogen])).toEqual([]);
  });

  it("reports duplicate identity fields", () => {
    expect(findElementCollectionProblems([hydrogen, hydrogen])).toEqual([
      { code: "duplicate_id", recordId: "element.hydrogen" },
      { code: "duplicate_atomic_number", recordId: "element.hydrogen" },
      { code: "duplicate_symbol", recordId: "element.hydrogen" },
    ]);
  });
});
