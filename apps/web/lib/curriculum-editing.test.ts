import type { PreparationProductionProduct } from "@inorganic/content/preparation-production-schema";
import { describe, expect, it } from "vitest";

import {
  clearedValidations,
  editProduct,
  editRoute,
  equationText,
  nextAdminSourceId,
  productDraft,
  routeDraft,
  slugify,
} from "./curriculum-editing";

const reviewed = {
  status: "reviewed" as const,
  reviewedBy: "reviewer.owner",
  reviewedAt: "2026-10-09",
  reviewFingerprint: `sha256:${"a".repeat(64)}`,
  reviewEvidence: "Skripta, str. 3",
};

const hydrogen: PreparationProductionProduct = {
  id: "preparation-production.product.vodik",
  nameCs: "Vodík",
  formula: "H2",
  notes: [],
  routes: [
    {
      id: "preparation-production.route.vodik-id-20-1-preparation",
      sourceId: "id-20-1",
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
      ...reviewed,
    },
    {
      id: "preparation-production.route.vodik-id-20-91-preparation",
      sourceId: "id-20-91",
      kind: "preparation",
      reactants: [{ coefficient: 1, formula: "Na2S2O3", acceptedAliases: ["S2Na2O3"] }],
      products: [{ coefficient: 1, formula: "H2" }],
      conditionsCs: null,
      status: "in-review",
      reviewNote: "Source equation is not atom-balanced.",
    },
  ],
  author: "Project curriculum import",
  sources: [{ title: "VŠCHT", locator: "https://e-learning.vscht.cz/rovnice" }],
  ownerApprovedBy: "Content owner",
  ownerApprovedAt: "2026-09-24",
  ...reviewed,
};

const firstRouteId = "preparation-production.route.vodik-id-20-1-preparation";

describe("equationText", () => {
  it("writes the equation in the form the editor parses", () => {
    expect(equationText(hydrogen.routes[0] as never)).toBe("Zn + 2 HCl -> H2 + ZnCl2");
  });
});

describe("editRoute", () => {
  it("clears the validation of a changed route and keeps its ID", () => {
    const result = editRoute([hydrogen], hydrogen, firstRouteId, {
      ...routeDraft(hydrogen.routes[0]),
      conditions: "t",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const route = result.product.routes[0];
    expect(route).toMatchObject({ id: firstRouteId, status: "owner-approved", conditionsCs: "t" });
    expect(route).not.toHaveProperty("reviewFingerprint");
    expect(result.product.status).toBe("reviewed");
  });

  it("keeps the validation when nothing the review covers changed", () => {
    const result = editRoute([hydrogen], hydrogen, firstRouteId, routeDraft(hydrogen.routes[0]));

    expect(result.ok && result.product.routes[0]).toMatchObject(reviewed);
  });

  it("rejects an unbalanced or unreduced equation with a Czech reason", () => {
    const unbalanced = editRoute([hydrogen], hydrogen, firstRouteId, {
      ...routeDraft(hydrogen.routes[0]),
      equation: "Zn + HCl -> ZnCl2 + H2",
    });
    const unreduced = editRoute([hydrogen], hydrogen, firstRouteId, {
      ...routeDraft(hydrogen.routes[0]),
      equation: "2 Zn + 4 HCl -> 2 ZnCl2 + 2 H2",
    });

    expect(unbalanced).toEqual({ ok: false, errors: [expect.stringContaining("není vyčíslená")] });
    expect(unreduced).toEqual({ ok: false, errors: [expect.stringContaining("nejmenším poměru")] });
  });

  it("rejects unknown elements and unreadable input", () => {
    expect(
      editRoute([hydrogen], hydrogen, null, {
        ...routeDraft(),
        equation: "Xx -> X",
        sourceId: "id-1",
      }).ok,
    ).toBe(false);
    expect(
      editRoute([hydrogen], hydrogen, null, {
        ...routeDraft(),
        equation: "Zn HCl",
        sourceId: "id-1",
      }),
    ).toEqual({ ok: false, errors: [expect.stringContaining("nepodařilo přečíst")] });
  });

  it("puts a corrected held route back as owner-approved and keeps its formula aliases", () => {
    const result = editRoute([hydrogen], hydrogen, hydrogen.routes[1]?.id ?? "", {
      ...routeDraft(hydrogen.routes[1]),
      equation: "Na2S2O3 + 2 HCl -> 2 NaCl + S + SO2 + H2O",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.routes[1]).toMatchObject({ status: "owner-approved" });
    expect(result.product.routes[1]).not.toHaveProperty("reviewNote");
    expect(result.product.routes[1]?.reactants[0]).toEqual({
      coefficient: 1,
      formula: "Na2S2O3",
      acceptedAliases: ["S2Na2O3"],
    });
  });

  it("gives a new route a fresh ID that no record uses", () => {
    const result = editRoute([hydrogen], hydrogen, null, {
      kind: "preparation",
      equation: "Zn + 2 HCl -> ZnCl2 + H2",
      conditions: "",
      sourceId: "id-20-1",
    });

    expect(result.ok && result.product.routes[2]?.id).toBe(`${firstRouteId}-2`);
  });
});

describe("editProduct", () => {
  it("creates a product with its first route and an ID from the Czech name", () => {
    const result = editProduct(
      [hydrogen],
      null,
      {
        ...productDraft(),
        nameCs: "Chlorid sodný",
        formula: "NaCl",
        sourceTitle: "Skripta",
        sourceLocator: "https://example.test/skripta",
      },
      {
        kind: "preparation",
        equation: "2 Na + Cl2 -> 2 NaCl",
        conditions: "",
        sourceId: "id-admin-1",
      },
      "2026-10-09",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({
      id: "preparation-production.product.chlorid-sodny",
      status: "owner-approved",
      notes: [],
      routes: [{ id: "preparation-production.route.chlorid-sodny-id-admin-1-preparation" }],
    });
  });

  it("rejects a source that is not https", () => {
    const result = editProduct(
      [hydrogen],
      hydrogen,
      { ...productDraft(hydrogen), sourceLocator: "http://example.test" },
      null,
      "2026-10-09",
    );

    expect(result).toEqual({ ok: false, errors: [expect.stringContaining("https://")] });
  });

  it("clears every validation when the name changes, and only the product's for a note", () => {
    const renamed = { ...productDraft(hydrogen), nameCs: "Vodík (H2)" };
    const noted = { ...productDraft(hydrogen), note: "Vyrábí se elektrolýzou vody." };

    expect(clearedValidations(hydrogen, renamed)).toBe(2);
    expect(clearedValidations(hydrogen, noted)).toBe(1);
    expect(clearedValidations(hydrogen, productDraft(hydrogen))).toBe(0);
  });
});

describe("helpers", () => {
  it("slugifies Czech names and finds a free console source label", () => {
    expect(slugify("Oxid uhličitý")).toBe("oxid-uhlicity");
    expect(nextAdminSourceId([hydrogen])).toBe("id-admin-1");
  });
});
