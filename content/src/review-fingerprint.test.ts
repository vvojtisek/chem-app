import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { preparationProductionCollectionSchema } from "./preparation-production-schema";
import { createReviewFingerprint } from "./review";
import {
  productFingerprintInput,
  reviewFingerprintPayload,
  routeFingerprintInput,
} from "./review-fingerprint";

async function webCryptoFingerprint(record: object): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(reviewFingerprintPayload(record)),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return `sha256:${hex.join("")}`;
}

describe("review fingerprint payload", () => {
  it("hashes to the Node fingerprint through Web Crypto for every product and route", async () => {
    const collection = preparationProductionCollectionSchema.parse(
      JSON.parse(
        await readFile(new URL("../data/preparation-production.json", import.meta.url), "utf8"),
      ),
    );
    for (const product of collection.products) {
      const productInput = productFingerprintInput(product);
      expect(await webCryptoFingerprint(productInput)).toBe(createReviewFingerprint(productInput));
      for (const route of product.routes) {
        const routeInput = routeFingerprintInput(product, route);
        expect(await webCryptoFingerprint(routeInput)).toBe(createReviewFingerprint(routeInput));
      }
    }
  });

  it("covers the product without routes and the route with its product identity", () => {
    const route = { id: "route", status: "owner-approved", conditionsCs: null };
    const product = {
      id: "product",
      nameCs: "Vodík",
      formula: "H2",
      sources: [{ title: "Zdroj", locator: "https://example.test" }],
      routes: [route],
      notes: [],
      status: "owner-approved",
    };

    expect(productFingerprintInput(product)).not.toHaveProperty("routes");
    expect(JSON.parse(reviewFingerprintPayload(routeFingerprintInput(product, route)))).toEqual({
      conditionsCs: null,
      id: "route",
      parent: { formula: "H2", id: "product", nameCs: "Vodík", sources: product.sources },
    });
  });
});
