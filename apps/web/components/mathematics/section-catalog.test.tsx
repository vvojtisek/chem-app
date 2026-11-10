import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import { mathTopics } from "@inorganic/content/higher-mathematics";
import { MathSectionCatalog } from "./section-catalog";

afterEach(cleanup);

describe("MathSectionCatalog", () => {
  it("links all nine sections to Učivo", () => {
    render(<MathSectionCatalog area="learn" topics={mathTopics} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(9);
    for (const [index, topic] of mathTopics.entries()) {
      expect(links[index]).toHaveAttribute("href", `/predmety/matematika/${topic.id}`);
      expect(links[index]).toHaveTextContent(topic.title);
      expect(links[index]).toHaveTextContent(`Okruh ${index + 1}`);
    }
  });

  it("links all nine sections to Procvičovat", () => {
    render(<MathSectionCatalog area="practice" topics={mathTopics} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(9);
    for (const [index, topic] of mathTopics.entries()) {
      expect(links[index]).toHaveAttribute("href", `/predmety/matematika/procvicovani/${topic.id}`);
    }
  });
});
