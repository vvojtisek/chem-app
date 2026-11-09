import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { HigherMathematicsCatalog } from "./higher-mathematics-catalog";

describe("HigherMathematicsCatalog", () => {
  it("links to all nine topic practice routes", () => {
    render(<HigherMathematicsCatalog topics={mathTopics} />);

    const links = screen.getAllByRole("link", { name: /Otevřít okruh/ });
    expect(links).toHaveLength(9);
    for (const topic of mathTopics) {
      expect(screen.getByRole("link", { name: new RegExp(topic.title) })).toHaveAttribute(
        "href",
        `/procvicovani/matematika/${topic.id}`,
      );
    }
  });
});
