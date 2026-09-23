import { describe, expect, it } from "vitest";
import { assertUniqueTopLevelKeys } from "./import-nomenclature-seed";

describe("seed import boundary", () => {
  it("rejects duplicate formula keys before JSON.parse can overwrite a record", () => {
    expect(() => assertUniqueTopLevelKeys('{"AgCl":{"nazev":"a"},"AgCl":{"nazev":"b"}}')).toThrow(
      "Duplicate seed key: AgCl",
    );
  });

  it("handles quoted text without treating it as another top-level key", () => {
    expect(() =>
      assertUniqueTopLevelKeys('{"AgCl":{"napoveda":"A \\"quoted\\" name"}}'),
    ).not.toThrow();
  });
});
