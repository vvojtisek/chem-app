import { afterEach, describe, expect, it } from "vitest";

import { saveReviewRequest, takeReviewRequest } from "./review-request";

afterEach(() => window.localStorage.clear());

describe("review request", () => {
  it("is taken once", () => {
    saveReviewRequest({ exercise: "equations", level: "pro", ids: ["product.a"] });
    expect(takeReviewRequest("equations")).toEqual({
      schemaVersion: 1,
      exercise: "equations",
      level: "pro",
      ids: ["product.a"],
    });
    expect(takeReviewRequest("equations")).toBeNull();
  });

  it("ignores and removes an invalid stored request", () => {
    window.localStorage.setItem(
      "inorganic.reviewRequest.nomenclature",
      JSON.stringify({ schemaVersion: 1, exercise: "nomenclature", direction: "x", ids: [] }),
    );
    expect(takeReviewRequest("nomenclature")).toBeNull();
    expect(window.localStorage.getItem("inorganic.reviewRequest.nomenclature")).toBeNull();
  });
});
