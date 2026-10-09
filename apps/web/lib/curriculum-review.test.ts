import { createHash } from "node:crypto";
import { reviewFingerprintPayload } from "@inorganic/content/review-fingerprint";
import { describe, expect, it } from "vitest";

import preparationProduction from "../../../content/data/preparation-production.json";

import {
  applyReviewAction,
  availableActions,
  countReviewStates,
  type StoredProduct,
  toFileProduct,
} from "./curriculum-review";

const fileProducts = (preparationProduction as { products: Record<string, unknown>[] }).products;

const productReviewKeys = [
  "reviewedBy",
  "reviewedAt",
  "reviewFingerprint",
  "reviewEvidence",
  "reviewEvidenceConfirmedBy",
];

/** What the API returns: every absent optional field becomes an explicit null. */
function asApiResponse(product: Record<string, unknown>): StoredProduct {
  const routes = (product.routes as Record<string, unknown>[]).map((route) => ({
    ...Object.fromEntries([...productReviewKeys, "reviewNote"].map((key) => [key, null])),
    ...route,
    reactants: (route.reactants as object[]).map((term) => ({ acceptedAliases: null, ...term })),
    products: (route.products as object[]).map((term) => ({ acceptedAliases: null, ...term })),
  }));
  return {
    ...Object.fromEntries(productReviewKeys.map((key) => [key, null])),
    ...product,
    routes,
  } as unknown as StoredProduct;
}

function nodeFingerprint(record: object): string {
  return `sha256:${createHash("sha256").update(reviewFingerprintPayload(record)).digest("hex")}`;
}

const evidence = { evidence: "Skripta, str. 12", confirmedBy: "  " };

describe("toFileProduct", () => {
  it("restores the exact file shape of every product from the API response", () => {
    for (const product of fileProducts) {
      expect(toFileProduct(asApiResponse(product))).toEqual(product);
    }
  });
});

describe("applyReviewAction", () => {
  const product = toFileProduct(asApiResponse(fileProducts[0] as Record<string, unknown>));
  const [firstRoute, secondRoute] = product.routes;
  if (firstRoute === undefined || secondRoute === undefined) throw new Error("fixture");

  it("validates one route with the fingerprint CI expects and leaves its siblings alone", async () => {
    const body = await applyReviewAction(
      product,
      { kind: "route", routeId: firstRoute.id },
      { kind: "validate", evidence: { evidence: " Skripta, str. 12 ", confirmedBy: "Prof. X" } },
    );
    const { status: _status, ...withoutStatus } = firstRoute;
    const expected = nodeFingerprint({
      ...withoutStatus,
      parent: {
        id: product.id,
        nameCs: product.nameCs,
        formula: product.formula,
        sources: product.sources,
      },
    });

    expect(body.routes[0]).toMatchObject({
      status: "reviewed",
      reviewFingerprint: expected,
      reviewEvidence: "Skripta, str. 12",
      reviewEvidenceConfirmedBy: "Prof. X",
    });
    expect(body.routes[1]).toMatchObject({ status: secondRoute.status, reviewFingerprint: null });
    expect(body.status).toBe(product.status);
    expect(body).not.toHaveProperty("author");
    expect(body.routes[0]).not.toHaveProperty("reviewedBy");
  });

  it("validates the product without its routes and drops a blank professor name", async () => {
    const body = await applyReviewAction(
      product,
      { kind: "product" },
      { kind: "validate", evidence },
    );
    const { routes: _routes, ...withoutRoutes } = product;

    expect(body).toMatchObject({
      status: "reviewed",
      reviewFingerprint: nodeFingerprint(withoutRoutes),
      reviewEvidenceConfirmedBy: null,
    });
    expect(body.routes.map((route) => route.status)).toEqual(
      product.routes.map((route) => route.status),
    );
  });

  it("removes and un-validates by clearing the evidence", async () => {
    const validated = {
      ...product,
      status: "reviewed" as const,
      reviewedBy: "reviewer.owner",
      reviewedAt: "2026-10-09",
      reviewFingerprint: `sha256:${"a".repeat(64)}`,
      reviewEvidence: "Skripta",
    };

    expect(
      await applyReviewAction(validated, { kind: "product" }, { kind: "unvalidate" }),
    ).toMatchObject({ status: "owner-approved", reviewFingerprint: null, reviewEvidence: null });
    expect(
      await applyReviewAction(validated, { kind: "product" }, { kind: "remove" }),
    ).toMatchObject({ status: "deprecated", reviewFingerprint: null });
  });

  it("keeps the evidence of a validated sibling so the server keeps its reviewer", async () => {
    const validatedSibling = {
      ...secondRoute,
      status: "reviewed" as const,
      reviewedBy: "reviewer.owner",
      reviewedAt: "2026-10-09",
      reviewFingerprint: `sha256:${"b".repeat(64)}`,
      reviewEvidence: "Skripta",
    };
    const body = await applyReviewAction(
      { ...product, routes: [firstRoute, validatedSibling] },
      { kind: "route", routeId: firstRoute.id },
      { kind: "remove" },
    );

    expect(body.routes[1]).toMatchObject({
      status: "reviewed",
      reviewFingerprint: validatedSibling.reviewFingerprint,
      reviewEvidence: "Skripta",
    });
  });
});

describe("availableActions", () => {
  const product = toFileProduct(asApiResponse(fileProducts[0] as Record<string, unknown>));
  const route = product.routes[0];
  if (route === undefined) throw new Error("fixture");

  it("offers only removal for a route held for review", async () => {
    const held = { ...product, routes: [{ ...route, status: "in-review" as const }] };
    const target = { kind: "route", routeId: route.id } as const;

    expect(availableActions(held, target)).toEqual(["remove"]);
    await expect(applyReviewAction(held, target, { kind: "validate", evidence })).rejects.toThrow();
  });

  it("offers nothing for a removed product or its routes", () => {
    const removed = { ...product, status: "deprecated" as const };

    expect(availableActions(removed, { kind: "product" })).toEqual([]);
    expect(availableActions(removed, { kind: "route", routeId: route.id })).toEqual([]);
  });
});

describe("countReviewStates", () => {
  it("counts the routes of a removed product as removed", () => {
    const products = fileProducts.slice(0, 2).map((item) => toFileProduct(asApiResponse(item)));
    const [first, second] = products;
    if (first === undefined || second === undefined) throw new Error("fixture");
    const counts = countReviewStates([{ ...first, status: "deprecated" }, second]);

    expect(counts.products).toEqual({ validated: 0, pending: 1, removed: 1 });
    expect(counts.routes.removed).toBe(first.routes.length);
    expect(counts.routes.pending).toBe(second.routes.length);
  });
});
