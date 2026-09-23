import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a same-origin relative destination", () => {
    expect(safeNext("/procvicovani/nazvoslovi?mode=1#zadani")).toBe(
      "/procvicovani/nazvoslovi?mode=1#zadani",
    );
  });
  it.each([
    "https://other.example/",
    "//other.example/",
    "/\\other.example",
    "login",
    "/login?next=/admin",
  ])("rejects unsafe destination %s", (value) => {
    expect(safeNext(value)).toBe("/");
  });
});
