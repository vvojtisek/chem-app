import { describe, expect, it } from "vitest";

import { cn } from "./class-names";

describe("cn", () => {
  it("joins the class names that are set", () => {
    expect(cn("rounded-xl", false, "bg-accent", null, undefined, "")).toBe("rounded-xl bg-accent");
  });
});
