import { describe, expect, it } from "vitest";

import { isNewerVersion } from "./app-version";

describe("isNewerVersion", () => {
  it.each([
    ["1.1.9", "1.1.8"],
    ["1.2.0", "1.1.8"],
    ["2.0.0", "1.9.9"],
    ["1.10.0", "1.9.0"],
  ])("treats %s as newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(true);
  });

  it.each([
    ["1.1.8", "1.1.8"],
    ["1.1.7", "1.1.8"],
    ["1.9.0", "1.10.0"],
    ["v1.2.0", "1.1.8"],
    ["1.2", "1.1.8"],
    ["1.2.0-rc.1", "1.1.8"],
    ["1.2.0", "unknown"],
  ])("does not treat %s as newer than %s", (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(false);
  });
});
