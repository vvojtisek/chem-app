import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { chemicalTextParts } from "@/lib/chemical-text";
import snapshot from "../../../content/generated/nomenclature-runtime.json";
import { ChemicalText } from "./chemical-text";

afterEach(cleanup);
describe("ChemicalText", () => {
  it("renders counts, explicit ion charges, legacy group charges and distinct oxidation states", () => {
    const { container } = render(
      <ChemicalText text="2 × Na^+ → (O2)^2-; SO4^2-; Fe^3+; O(-I); (NH4)(+I); H2O; MgCl2·6H2O" />,
    );
    expect([...container.querySelectorAll("sup")].map((node) => node.textContent)).toEqual([
      "+",
      "2−",
      "2−",
      "3+",
      "−I",
      "+",
    ]);
    expect([...container.querySelectorAll("sub")].map((node) => node.textContent)).toEqual([
      "2",
      "4",
      "4",
      "2",
      "2",
      "2",
    ]);
    expect(container).toHaveTextContent("→");
    expect(container).not.toHaveTextContent("->");
    expect(container.querySelector('[aria-label="oxidační číslo −I"]')).not.toBeNull();
  });
  it("does not turn an atom's oxidation state into a real ion charge", () => {
    expect(chemicalTextParts("S(+VI) v H2SO4")).toContainEqual(
      expect.objectContaining({ formula: "S", charge: 0, oxidation: "+VI" }),
    );
  });
  it("preserves prose, unknown symbols and untrusted HTML as text", () => {
    const text = "Kationty, Anion, Helium, Xx2 a <script>alert(1)</script>";
    const { container } = render(<ChemicalText text={text} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("sub")).toBeNull();
  });
  it("audits every shipped explanation for unformatted legacy oxidation/group annotations", () => {
    for (const record of snapshot.compounds) {
      const remaining = chemicalTextParts(record.explanationCs)
        .filter((part) => part.kind === "text")
        .map((part) => part.text)
        .join(" ");
      expect(remaining, record.id).not.toMatch(/[A-Z][a-z]?\([+−-][IVX]+\)/u);
      expect(remaining, record.id).not.toContain("->");
    }
  });
});
