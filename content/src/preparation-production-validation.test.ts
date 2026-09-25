import { describe, expect, it } from "vitest";
import {
  type PreparationProductionProduct,
  preparationProductionProductSchema,
  preparationProductionRouteSchema,
} from "./preparation-production-schema";
import { findPreparationProductionProblems } from "./preparation-production-validation";

const symbols = new Set(["H", "O", "Zn", "Cl"]);
const product = preparationProductionProductSchema.parse({
  id: "preparation-production.product.test-hydrogen",
  nameCs: "Vodík",
  formula: "H2",
  notes: [],
  routes: [
    {
      id: "preparation-production.route.test-hydrogen",
      sourceId: "id-test-hydrogen",
      kind: "preparation",
      reactants: [
        { coefficient: 1, formula: "Zn" },
        { coefficient: 2, formula: "HCl" },
      ],
      products: [
        { coefficient: 1, formula: "H2" },
        { coefficient: 1, formula: "ZnCl2" },
      ],
      conditionsCs: null,
      status: "owner-approved",
    },
  ],
  status: "owner-approved",
  author: "Fixture author",
  sources: [{ title: "Fixture source", locator: "https://example.test/source" }],
  ownerApprovedBy: "Fixture owner",
  ownerApprovedAt: "2026-09-24",
});
const baseRoute = product.routes[0];
if (!baseRoute) throw new Error("Missing preparation fixture route.");

function codes(products: readonly PreparationProductionProduct[]): string[] {
  return findPreparationProductionProblems(products, symbols).map((problem) => problem.code);
}

describe("preparation and production validation", () => {
  it("accepts a sourced, balanced, reduced approved equation", () => {
    expect(codes([product])).toEqual([]);
  });

  it.each([
    [
      "unbalanced_approved_equation",
      {
        reactants: [
          { coefficient: 1, formula: "Zn" },
          { coefficient: 1, formula: "HCl" },
        ],
      },
    ],
    [
      "unreduced_approved_equation",
      {
        reactants: [
          { coefficient: 2, formula: "Zn" },
          { coefficient: 4, formula: "HCl" },
        ],
        products: [
          { coefficient: 2, formula: "H2" },
          { coefficient: 2, formula: "ZnCl2" },
        ],
      },
    ],
    ["invalid_equation_formula", { products: [{ coefficient: 1, formula: "Xy2" }] }],
  ] as const)("rejects %s", (expected, change) => {
    const route = preparationProductionRouteSchema.parse({ ...baseRoute, ...change });
    expect(codes([{ ...product, routes: [route] }])).toContain(expected);
  });

  it("requires review notes for held equations and a source for approved products", () => {
    expect(
      codes([
        {
          ...product,
          sources: [],
          routes: [{ ...baseRoute, status: "in-review" }],
        },
      ]),
    ).toEqual(["missing_source", "unreviewed_route_without_note"]);
  });

  it("rejects duplicate IDs and unknown product symbols", () => {
    expect(codes([product, { ...product, formula: "Xy2" }])).toEqual([
      "duplicate_product_id",
      "invalid_product_formula",
      "duplicate_route_id",
    ]);
  });

  it("accepts an explicit equivalent notation and rejects invalid aliases", () => {
    expect(
      codes([
        {
          ...product,
          routes: [
            {
              ...baseRoute,
              products: [
                { coefficient: 1, formula: "H2" },
                { coefficient: 1, formula: "ZnCl2", acceptedAliases: ["Zn(Cl)2"] },
              ],
            },
          ],
        },
      ]),
    ).toEqual([]);
    const aliases = (acceptedAliases: string[]) =>
      codes([
        {
          ...product,
          routes: [
            {
              ...baseRoute,
              products: [
                { coefficient: 1, formula: "H2", acceptedAliases },
                { coefficient: 1, formula: "ZnCl2" },
              ],
            },
          ],
        },
      ]);
    expect(aliases(["H₂"])).toContain("invalid_equation_alias");
    expect(aliases(["H2O"])).toContain("invalid_equation_alias");
    expect(aliases(["Xy2"])).toContain("invalid_equation_alias");
  });
});
