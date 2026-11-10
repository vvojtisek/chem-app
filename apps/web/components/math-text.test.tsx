import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathText } from "./math-text";

describe("MathText", () => {
  it("renders inline TeX as KaTeX with a MathML equivalent", () => {
    const { container } = render(<MathText>Výraz $x^2+1$ je kladný.</MathText>);

    expect(container.querySelector(".katex")).toBeInTheDocument();
    expect(
      container.querySelector("math annotation[encoding='application/x-tex']"),
    ).toHaveTextContent("x^2+1");
    expect(container.textContent).toContain("Výraz ");
    expect(container.textContent).toContain("je kladný.");
  });
});
