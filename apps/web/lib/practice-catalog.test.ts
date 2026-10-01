// @vitest-environment node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { practiceCategories } from "./practice-catalog";

const appDirectory = fileURLToPath(new URL("../app/", import.meta.url));
const links = practiceCategories.flatMap((category) =>
  category.links.map((link) => [category.title, link.label, link.href] as const),
);

describe("practice catalog", () => {
  it.each(links)("%s › %s launches an exercise, not a study page", (_category, _label, href) => {
    expect(href).toMatch(/^\/(?:procvicovani|flashcards)\//u);
  });

  it.each(links)("%s › %s points to an existing page (%s)", (_category, _label, href) => {
    expect(existsSync(`${appDirectory}${href.slice(1)}/page.tsx`)).toBe(true);
  });

  it("gives every category exactly one primary action", () => {
    for (const category of practiceCategories) {
      expect(category.links.filter((link) => link.primary)).toHaveLength(1);
    }
  });
});
