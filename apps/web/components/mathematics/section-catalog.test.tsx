import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathPracticeCatalog } from "./practice-catalog";

describe("MathPracticeCatalog", () => {
  it("links all nine sections inside the mathematics subject area", () => {
    render(<MathPracticeCatalog topics={mathTopics} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(9);
    for (const [index, topic] of mathTopics.entries()) {
      expect(links[index]).toHaveAttribute("href", `/predmety/matematika/procvicovani/${topic.id}`);
      expect(links[index]).toHaveTextContent(topic.title);
      expect(links[index]).toHaveTextContent(`Okruh ${index + 1}`);
    }
  });
});
