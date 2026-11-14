import { describe, expect, it } from "vitest";

import { reportQuestionUrl } from "./report-question";

describe("reportQuestionUrl", () => {
  it("prefills a GitHub issue with content identifiers only", () => {
    const url = new URL(
      reportQuestionUrl({
        exercise: "Názvosloví",
        questionId: "nomenclature.na2s2o3",
        prompt: "Na2S2O3",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://github.com/vvojtisek/chem-app/issues/new");
    expect(url.searchParams.get("title")).toBe("Chyba v otázce: Na2S2O3");
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("ID otázky: nomenclature.na2s2o3");
    expect(body).toContain("Cvičení: Názvosloví");
    expect(body).not.toMatch(/Vaše odpověď/u);
  });
});
