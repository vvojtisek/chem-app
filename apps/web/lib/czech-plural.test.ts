import { describe, expect, it } from "vitest";

import { czechCount, formatAccuracy, formatPercent } from "./czech-plural";

const ANSWERS = ["odpověď", "odpovědi", "odpovědí"] as const;

describe("czechCount", () => {
  it.each([
    [0, "0 odpovědí"],
    [1, "1 odpověď"],
    [2, "2 odpovědi"],
    [4, "4 odpovědi"],
    [5, "5 odpovědí"],
    [22, "22 odpovědí"],
  ])("writes %i as %s", (count, expected) => {
    expect(czechCount(count, ANSWERS)).toBe(expected);
  });
});

describe("formatAccuracy", () => {
  it("uses a decimal comma and a non-breaking space before the percent sign", () => {
    expect(formatAccuracy(331, 412)).toBe("80,3 %");
    expect(formatAccuracy(3, 3)).toBe("100 %");
    expect(formatPercent(66.66)).toBe("66,7 %");
  });

  it("has no value without answers", () => {
    expect(formatAccuracy(0, 0)).toBeNull();
  });
});
