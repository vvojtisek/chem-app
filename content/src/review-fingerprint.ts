/**
 * Browser-safe parts of the review fingerprint.
 *
 * The fingerprint is `sha256:` plus the hex SHA-256 of {@link reviewFingerprintPayload}.
 * Node (`review.ts`) and the admin console hash the same payload, so a validation
 * recorded in the browser passes the `stale_review_fingerprint` check in CI.
 */

export const reviewMetadataKeys: ReadonlySet<string> = new Set([
  "status",
  "author",
  "reviewedBy",
  "reviewedAt",
  "reviewFingerprint",
  "ownerApprovedBy",
  "ownerApprovedAt",
  "reviewNote",
  "reviewEvidence",
  "reviewEvidenceConfirmedBy",
]);

/** Canonical JSON of the reviewed (non-metadata) fields of one record. */
export function reviewFingerprintPayload(record: object): string {
  const reviewedFields = Object.entries(record).filter(([key]) => !reviewMetadataKeys.has(key));
  return toCanonicalJson(Object.fromEntries(reviewedFields));
}

interface FingerprintedProduct {
  readonly id: string;
  readonly nameCs: string;
  readonly formula: string;
  readonly sources: readonly object[];
  readonly routes: readonly object[];
}

/** The product attestation covers the product without its routes. */
export function productFingerprintInput<T extends FingerprintedProduct>(
  product: T,
): Omit<T, "routes"> {
  const { routes: _routes, ...productWithoutRoutes } = product;
  return productWithoutRoutes;
}

/**
 * The route attestation also covers the product identity and cited source.
 * Reviewing a sibling route cannot invalidate this route's fingerprint.
 */
export function routeFingerprintInput<T extends object>(
  product: FingerprintedProduct,
  route: T,
): T & { readonly parent: object } {
  return {
    ...route,
    parent: {
      id: product.id,
      nameCs: product.nameCs,
      formula: product.formula,
      sources: product.sources,
    },
  };
}

export function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(toCanonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => compareCodeUnits(left, right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${toCanonicalJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
